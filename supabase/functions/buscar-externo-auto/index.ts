// Genera búsquedas externas para una persona (o todas) y crea sugerencias accionables.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const enc = encodeURIComponent;

function buildSearches(p: any) {
  const out: { plataforma: string; url: string; query: string }[] = [];
  const nombres = p.nombres ?? "";
  const apellidos = p.apellidos ?? "";
  const apellido1 = apellidos.split(/\s+/)[0] ?? "";
  const nac = p.nac_fecha ? new Date(p.nac_fecha).getUTCFullYear() : p.nac_rango_ini ?? null;
  const def = p.defuncion_fecha ? new Date(p.defuncion_fecha).getUTCFullYear() : null;

  out.push({ plataforma: "FamilySearch", query: `${nombres} ${apellidos}`,
    url: `https://www.familysearch.org/search/record/results?q.givenName=${enc(nombres)}&q.surname=${enc(apellidos)}${nac ? `&q.birthLikeDate.from=${nac-5}&q.birthLikeDate.to=${nac+5}` : ""}` });
  out.push({ plataforma: "MyHeritage", query: `${nombres} ${apellidos}`,
    url: `https://www.myheritage.es/research?formId=master&qname=Name+fnmo.${enc(nombres)}+lnmo.${enc(apellidos)}${nac ? `&qevents-event/-/start=Event+et.birth+ed.${nac}+ev.5` : ""}` });
  out.push({ plataforma: "Ancestry", query: `${nombres} ${apellidos}`,
    url: `https://www.ancestry.com/search/?name=${enc(nombres)}+${enc(apellido1)}${nac ? `&birth=${nac}` : ""}` });
  out.push({ plataforma: "Geneanet", query: `${nombres} ${apellido1}`,
    url: `https://en.geneanet.org/fonds/individus/?go=1&nom=${enc(apellido1)}&prenom=${enc(nombres)}${nac ? `&place_birth=&date_naissance=${nac}` : ""}` });
  out.push({ plataforma: "Google", query: `"${nombres} ${apellido1}" genealogía`,
    url: `https://www.google.com/search?q=${enc(`"${nombres} ${apellido1}"${nac ? ` ${nac-5}..${nac+5}` : ""} genealogía`)}` });
  if (def) out.push({ plataforma: "Google — defunción", query: `${nombres} ${apellido1} defunción`,
    url: `https://www.google.com/search?q=${enc(`"${nombres} ${apellido1}" defunción ${def-10}..${def+10}`)}` });
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("No autenticado");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión inválida");

    const { persona_id, scope } = await req.json().catch(() => ({}));

    let personas: any[] = [];
    if (persona_id) {
      const { data } = await supabase.from("personas").select("*").eq("id", persona_id).eq("user_id", user.id);
      personas = data ?? [];
    } else if (scope === "all") {
      const { data } = await supabase.from("personas").select("*").eq("user_id", user.id).limit(50);
      personas = data ?? [];
    } else {
      throw new Error("Falta persona_id o scope");
    }

    let creadas = 0;
    for (const p of personas) {
      const items = buildSearches(p);
      for (const it of items) {
        const { error } = await supabase.from("sugerencias").insert({
          user_id: user.id,
          persona_id: p.id,
          tipo: "fuente_externa",
          tipo_externo: it.plataforma,
          url_externa: it.url,
          titulo: `${it.plataforma}: ${p.nombres} ${p.apellidos}`,
          descripcion: `Búsqueda preparada: ${it.query}`,
          payload: { plataforma: it.plataforma, query: it.query, url: it.url },
          confianza: 50,
          origen: "buscar-externo-auto",
        });
        if (!error) creadas++;
      }
    }

    return new Response(JSON.stringify({ ok: true, personas: personas.length, sugerencias: creadas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
