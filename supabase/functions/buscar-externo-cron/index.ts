// Cron nocturno: genera sugerencias externas para las personas con menos sugerencias recientes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const enc = encodeURIComponent;
function buildSearches(p: any) {
  const out: { plataforma: string; url: string; query: string }[] = [];
  const n = p.nombres ?? ""; const a = p.apellidos ?? "";
  const a1 = a.split(/\s+/)[0] ?? "";
  const nac = p.nac_fecha ? new Date(p.nac_fecha).getUTCFullYear() : p.nac_rango_ini ?? null;
  out.push({ plataforma: "FamilySearch", query: `${n} ${a}`,
    url: `https://www.familysearch.org/search/record/results?q.givenName=${enc(n)}&q.surname=${enc(a)}${nac ? `&q.birthLikeDate.from=${nac-5}&q.birthLikeDate.to=${nac+5}` : ""}` });
  out.push({ plataforma: "MyHeritage", query: `${n} ${a}`,
    url: `https://www.myheritage.es/research?formId=master&qname=Name+fnmo.${enc(n)}+lnmo.${enc(a)}` });
  out.push({ plataforma: "Ancestry", query: `${n} ${a}`,
    url: `https://www.ancestry.com/search/?name=${enc(n)}+${enc(a1)}${nac ? `&birth=${nac}` : ""}` });
  out.push({ plataforma: "Geneanet", query: `${n} ${a1}`,
    url: `https://en.geneanet.org/fonds/individus/?go=1&nom=${enc(a1)}&prenom=${enc(n)}` });
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Selecciona hasta 30 personas con menos sugerencias 'fuente_externa'.
    const { data: personas } = await supabase
      .from("personas")
      .select("id, user_id, nombres, apellidos, nac_fecha, nac_rango_ini")
      .order("updated_at", { ascending: true })
      .limit(30);

    let creadas = 0;
    for (const p of personas ?? []) {
      // Saltar si ya tiene sugerencias externas recientes (<7 días)
      const desde = new Date(Date.now() - 7 * 86400000).toISOString();
      const { count } = await supabase
        .from("sugerencias")
        .select("id", { count: "exact", head: true })
        .eq("persona_id", p.id)
        .eq("tipo", "fuente_externa")
        .gte("created_at", desde);
      if ((count ?? 0) > 0) continue;

      for (const it of buildSearches(p)) {
        const { error } = await supabase.from("sugerencias").insert({
          user_id: p.user_id,
          persona_id: p.id,
          tipo: "fuente_externa",
          tipo_externo: it.plataforma,
          url_externa: it.url,
          titulo: `${it.plataforma}: ${p.nombres} ${p.apellidos}`,
          descripcion: `Búsqueda automática nocturna: ${it.query}`,
          payload: { plataforma: it.plataforma, query: it.query, url: it.url },
          confianza: 45,
          origen: "cron-buscar-externo",
        });
        if (!error) creadas++;
      }
    }

    return new Response(JSON.stringify({ ok: true, procesadas: personas?.length ?? 0, creadas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
