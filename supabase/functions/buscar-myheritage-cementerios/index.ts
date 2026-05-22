// Genera enlaces de búsqueda dirigidos en MyHeritage, FamilySearch, BillionGraves,
// FindAGrave y registros cementerios para una persona, y los guarda como `sugerencias`
// con tipo "fuente_externa" para que el usuario las revise y abra.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const enc = (s: string) => encodeURIComponent(s.trim());

function buildLinks(p: any) {
  const nombre = (p.nombres ?? "").trim();
  const apellido = (p.apellidos ?? "").trim().split(/\s+/)[0] ?? "";
  const ano = p.nac_fecha ? new Date(p.nac_fecha).getFullYear() : null;
  const q = `${nombre} ${apellido}`.trim();

  const links: Array<{ titulo: string; url: string; plataforma: string }> = [];

  // MyHeritage Records Search
  links.push({
    plataforma: "myheritage",
    titulo: `MyHeritage · Registros de ${q}`,
    url: `https://www.myheritage.es/research?action=query&formId=master&qname=Name+fn.${enc(nombre)}+ln.${enc(apellido)}${ano ? `&qbirth=Date+from.${ano - 3}+to.${ano + 3}` : ""}`,
  });
  links.push({
    plataforma: "myheritage",
    titulo: `MyHeritage · Árboles familiares con ${apellido}`,
    url: `https://www.myheritage.es/research/category-1/family-trees?formId=master&qname=Name+fn.${enc(nombre)}+ln.${enc(apellido)}`,
  });

  // FamilySearch
  links.push({
    plataforma: "familysearch",
    titulo: `FamilySearch · Registros históricos de ${q}`,
    url: `https://www.familysearch.org/search/record/results?q.givenName=${enc(nombre)}&q.surname=${enc(apellido)}${ano ? `&q.birthLikeDate.from=${ano - 2}&q.birthLikeDate.to=${ano + 2}` : ""}`,
  });

  // BillionGraves
  links.push({
    plataforma: "billiongraves",
    titulo: `BillionGraves · Lápidas de ${q}`,
    url: `https://billiongraves.es/search/results?given_names=${enc(nombre)}&family_names=${enc(apellido)}${p.defuncion_fecha ? `&year_died=${new Date(p.defuncion_fecha).getFullYear()}` : ""}`,
  });

  // Find a Grave
  links.push({
    plataforma: "findagrave",
    titulo: `Find a Grave · Memoriales de ${q}`,
    url: `https://www.findagrave.com/memorial/search?firstname=${enc(nombre)}&lastname=${enc(apellido)}${p.defuncion_fecha ? `&deathyear=${new Date(p.defuncion_fecha).getFullYear()}&deathyearfilter=5` : ""}`,
  });

  // Cementerio General de Santiago (CL)
  links.push({
    plataforma: "cementerio_cl",
    titulo: `Cementerio General de Santiago · ${q}`,
    url: `https://www.cementeriogeneral.cl/sepulcros/?nombre=${enc(q)}`,
  });

  // Periódicos digitales (Memoria Chilena / BNE Hemeroteca)
  links.push({
    plataforma: "periodico",
    titulo: `Memoria Chilena · ${q}`,
    url: `https://www.memoriachilena.gob.cl/602/w3-search.html?qt=${enc(q)}`,
  });
  links.push({
    plataforma: "periodico",
    titulo: `Hemeroteca BNE · ${q}`,
    url: `https://www.bne.es/es/catalogos/hemeroteca-digital?q=${enc(q)}`,
  });

  return links;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const auth = req.headers.get("Authorization") ?? "";
    const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser();
    const user = u.user;
    if (!user) return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { persona_id } = await req.json().catch(() => ({}));
    if (!persona_id) throw new Error("Falta persona_id");

    const { data: p } = await sb.from("personas").select("id,nombres,apellidos,nac_fecha,defuncion_fecha").eq("user_id", user.id).eq("id", persona_id).maybeSingle();
    if (!p) throw new Error("Persona no encontrada");

    const links = buildLinks(p);
    const rows = links.map((l) => ({
      user_id: user.id,
      persona_id,
      tipo: "fuente_externa",
      titulo: l.titulo,
      descripcion: `Búsqueda dirigida en ${l.plataforma}. Abre y revisa coincidencias.`,
      origen: l.plataforma,
      tipo_externo: l.plataforma,
      url_externa: l.url,
      confianza: 50,
      payload: { plataforma: l.plataforma },
    }));

    await sb.from("sugerencias").insert(rows);
    await sb.from("busquedas_externas").insert(links.map((l) => ({
      user_id: user.id, persona_id, plataforma: l.plataforma,
      query: `${p.nombres} ${p.apellidos}`, url: l.url, objetivo: "registros/cementerios",
    })));

    await sb.from("notificaciones").insert({
      user_id: user.id, titulo: "Búsquedas externas listas",
      mensaje: `${rows.length} enlaces dirigidos para ${p.nombres} ${p.apellidos} (MyHeritage, FamilySearch, cementerios, periódicos).`,
      tipo: "info", url: `/personas/${persona_id}`,
    });

    return new Response(JSON.stringify({ ok: true, creadas: rows.length, links }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
