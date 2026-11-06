import { exportGedcom } from "../_shared/gedcomExport.ts";
import { collectRows } from "../_shared/collectRows.ts";
import { rejectUnauthenticated } from "../_shared/auth.ts";
// Exporta el árbol local del usuario como GEDCOM 5.5.1
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const geneaiAccessRejection = await rejectUnauthenticated(req);
  if (geneaiAccessRejection) return geneaiAccessRejection;
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return jsonResponse({ error: "No autenticado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Sesión inválida" }, 401);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("active_arbol_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const treeId = typeof profile?.active_arbol_id === "string"
      ? profile.active_arbol_id.trim()
      : "";
    if (!treeId) {
      return jsonResponse({ error: "Selecciona un archivo familiar antes de exportar." }, 409);
    }

    const { data: ownedTree, error: treeError } = await supabase
      .from("arboles")
      .select("id")
      .eq("id", treeId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (treeError) throw treeError;
    if (!ownedTree) {
      return jsonResponse({ error: "El archivo familiar activo no está disponible para esta cuenta." }, 409);
    }

    const [personas, relaciones, lugares] = await Promise.all([
      collectRows((from, to) => supabase.from("personas").select("*").eq("user_id",user.id).eq("arbol_id",treeId).order("id").range(from,to)),
      collectRows((from, to) => supabase.from("relaciones").select("*").eq("user_id",user.id).or(`arbol_id.eq.${treeId},arbol_id.is.null`).order("id").range(from,to)),
      collectRows((from, to) => supabase.from("lugares").select("id,ciudad,provincia,region,pais,parroquia").eq("user_id",user.id).order("id").range(from,to)),
    ]);
    const gedcom = exportGedcom(personas, relaciones, lugares);

    return new Response(gedcom, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename=arbol-familiar.ged`,
      },
    });
  } catch (error: unknown) {
    console.error("familysearch-export failed", error);
    return jsonResponse({ error: "No se pudo exportar el archivo familiar." }, 500);
  }
});
