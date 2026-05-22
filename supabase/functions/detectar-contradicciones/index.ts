// Detecta inconsistencias genealógicas: hijos antes que padres,
// muertes antes de nacer, edades imposibles al matrimonio, padres demasiado
// jóvenes/viejos al nacer un hijo, dobles fechas, etc.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function yearOf(s?: string | null): number | null {
  if (!s) return null;
  const m = String(s).match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}
function dateOf(s?: string | null): Date | null {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(s);
  return isNaN(+d) ? null : d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "no auth" }), { status: 401, headers: corsHeaders });

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: u } = await sb.auth.getUser();
    const userId = u?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "no user" }), { status: 401, headers: corsHeaders });

    const [{ data: personas }, { data: relaciones }] = await Promise.all([
      sb.from("personas")
        .select("id, nombres, apellidos, nac_fecha, nac_fecha_aprox, defuncion_fecha, bautismo_fecha, matrimonio_fecha")
        .eq("user_id", userId).limit(10000),
      sb.from("relaciones").select("persona_id, pariente_id, tipo").eq("user_id", userId).limit(20000),
    ]);

    const idx = new Map<string, any>();
    for (const p of personas ?? []) idx.set(p.id, p);

    type C = { tipo: string; severidad: "alta" | "media" | "baja"; titulo: string; descripcion: string; personas: string[] };
    const hallazgos: C[] = [];
    const label = (p: any) => `${p?.nombres ?? ""} ${p?.apellidos ?? ""}`.trim() || "Sin nombre";

    // Por persona
    for (const p of personas ?? []) {
      const nY = yearOf(p.nac_fecha || p.nac_fecha_aprox);
      const dY = yearOf(p.defuncion_fecha);
      const bY = yearOf(p.bautismo_fecha);
      const mY = yearOf(p.matrimonio_fecha);

      if (nY && dY && dY < nY) hallazgos.push({
        tipo: "fechas_invalidas", severidad: "alta",
        titulo: `Fallece antes de nacer: ${label(p)}`,
        descripcion: `Nacimiento ${nY} > defunción ${dY}. Revisar fuentes.`,
        personas: [p.id],
      });
      if (nY && dY && dY - nY > 115) hallazgos.push({
        tipo: "edad_imposible", severidad: "media",
        titulo: `Edad superior a 115 años: ${label(p)}`,
        descripcion: `Habría vivido ${dY - nY} años (${nY}–${dY}).`,
        personas: [p.id],
      });
      if (nY && bY && bY < nY) hallazgos.push({
        tipo: "bautismo_antes_nac", severidad: "media",
        titulo: `Bautismo anterior al nacimiento: ${label(p)}`,
        descripcion: `Bautismo ${bY} antes de nacimiento ${nY}.`,
        personas: [p.id],
      });
      if (nY && mY && mY - nY < 12) hallazgos.push({
        tipo: "matrimonio_temprano", severidad: "baja",
        titulo: `Matrimonio antes de los 12 años: ${label(p)}`,
        descripcion: `Edad calculada al matrimonio: ${mY - nY}.`,
        personas: [p.id],
      });
    }

    // Relaciones padre/madre -> hijo
    for (const r of relaciones ?? []) {
      if (r.tipo !== "padre" && r.tipo !== "madre") continue;
      const hijo = idx.get(r.persona_id);
      const padre = idx.get(r.pariente_id);
      if (!hijo || !padre) continue;
      const hY = yearOf(hijo.nac_fecha || hijo.nac_fecha_aprox);
      const pY = yearOf(padre.nac_fecha || padre.nac_fecha_aprox);
      const pD = yearOf(padre.defuncion_fecha);
      if (hY && pY && hY < pY + 12) hallazgos.push({
        tipo: "padre_demasiado_joven", severidad: "alta",
        titulo: `${r.tipo === "madre" ? "Madre" : "Padre"} demasiado joven: ${label(padre)} → ${label(hijo)}`,
        descripcion: `Edad al nacer hijo/a: ${hY - pY}.`,
        personas: [padre.id, hijo.id],
      });
      if (hY && pY && hY - pY > 65) hallazgos.push({
        tipo: "padre_demasiado_viejo", severidad: "media",
        titulo: `${r.tipo === "madre" ? "Madre" : "Padre"} de edad inverosímil: ${label(padre)} → ${label(hijo)}`,
        descripcion: `Edad al nacer hijo/a: ${hY - pY}.`,
        personas: [padre.id, hijo.id],
      });
      if (hY && pD && hY > pD + 1) hallazgos.push({
        tipo: r.tipo === "madre" ? "madre_muerta_antes_hijo" : "padre_premortem",
        severidad: "alta",
        titulo: `${label(padre)} habría tenido a ${label(hijo)} tras su muerte`,
        descripcion: `${r.tipo === "madre" ? "Madre" : "Padre"} murió en ${pD}, hijo/a nació en ${hY}.`,
        personas: [padre.id, hijo.id],
      });
    }

    // Limpiar contradicciones abiertas previas y reinsertar
    await sb.from("contradicciones").delete().eq("user_id", userId).eq("estado", "abierta");
    if (hallazgos.length) {
      await sb.from("contradicciones").insert(
        hallazgos.map((h) => ({ ...h, user_id: userId }))
      );
    }

    return new Response(JSON.stringify({ ok: true, total: hallazgos.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detectar-contradicciones", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
