import { findIdentityCandidates } from "../_shared/identityCandidates.ts";
import { collectRows } from "../_shared/collectRows.ts";
import { rejectUnauthenticated } from "../_shared/auth.ts";
// Detecta pares de personas potencialmente duplicadas y los inserta en `coincidencias`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  const geneaiAccessRejection = await rejectUnauthenticated(req);
  if (geneaiAccessRejection) return geneaiAccessRejection;
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("No autenticado");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("active_arbol_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    const treeId = (profile?.active_arbol_id ?? null) as string | null;
    if (!treeId) throw new Error("Selecciona un archivo familiar antes de buscar coincidencias.");
    const { data: ownedTree, error: treeError } = await supabase
      .from("arboles")
      .select("id")
      .eq("id", treeId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (treeError) throw treeError;
    if (!ownedTree) throw new Error("El archivo familiar activo no está disponible para esta cuenta.");

    const [personas, equivalents] = await Promise.all([
      collectRows((from,to) => supabase.from('personas').select('id,nombres,apellidos,variantes_nombre,nac_fecha,nac_fecha_aprox,nac_rango_ini,nac_rango_fin,defuncion_fecha,nac_lugar_id,sexo').eq('user_id',user.id).eq('arbol_id',treeId).is('fusionado_en',null).order('id').range(from,to)),
      collectRows((from,to) => supabase.from('equivalencias_nombre').select('nombre_base,equivalente').eq('user_id',user.id).order('id').range(from,to)),
    ]);
    const ps = personas;
    const activePersonIds = new Set(ps.map((person) => person.id));

    // Existing pairs to avoid duplicates
    const existing = await collectRows((from,to) => supabase.from("coincidencias").select("ref_a,ref_b").eq("user_id",user.id).eq("tipo","persona").order("id").range(from,to));
    const seen = new Set<string>((existing ?? []).filter((entry: any) =>
      activePersonIds.has(entry.ref_a) && activePersonIds.has(entry.ref_b)
    ).map((e: any) => {
      const [a, b] = [e.ref_a, e.ref_b].sort();
      return `${a}|${b}`;
    }));

    const candidates = findIdentityCandidates(ps, equivalents);
    const found = candidates.filter(c => !seen.has([c.a.id,c.b.id].sort().join("|"))).slice(0,200).map(c => {
      const [ref_a,ref_b] = [c.a.id,c.b.id].sort();
      return {user_id:user.id,tipo:"persona",ref_a,ref_b,score:0,razones:[...c.indicios,...c.contradicciones.map(reason => `Contradicción: ${reason}`),"Candidato sin verificar: comparar las fuentes antes de decidir."]};
    });

    let creadas = 0;
    if (found.length) {
      const { data: inserted, error } = await supabase.from("coincidencias").insert(found).select("id");
      if (error) throw error;
      creadas = inserted?.length ?? 0;
    }

    const { error: activityError } = await supabase.from("actividad").insert({
      user_id: user.id, tipo: "deteccion",
      descripcion: `Detección de coincidencias: ${creadas} candidatos sin verificar (${ps.length} personas analizadas)`,
      metadata: { creadas, analizadas: ps.length, arbol_id: treeId, verificacion: "pendiente" },
    });
    if (activityError) throw activityError;

    return new Response(JSON.stringify({
      creadas,
      analizadas: ps.length,
      candidatos_totales: candidates.length,
      truncado: candidates.length > 200,
      arbol_id: treeId,
      verificacion: "sin_verificar",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
