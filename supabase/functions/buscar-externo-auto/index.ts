// Genera búsquedas externas para una persona (o todas) y crea sugerencias accionables.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const enc = encodeURIComponent;

// Quita acentos / diacríticos
const stripAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Variantes fonéticas comunes en español/italiano para tolerar errores ortográficos.
function nameVariants(s: string): string[] {
  const base = stripAccents((s ?? "").trim()).toLowerCase();
  if (!base) return [];
  const variants = new Set<string>([base]);
  const swaps: [RegExp, string][] = [
    [/v/g, "b"], [/b/g, "v"],
    [/y/g, "i"], [/i/g, "y"],
    [/z/g, "s"], [/s/g, "z"],
    [/c([ei])/g, "s$1"], [/k/g, "c"],
    [/ll/g, "y"], [/j/g, "g"], [/g([ei])/g, "j$1"],
    [/ph/g, "f"], [/qu/g, "k"],
    [/h/g, ""], // h muda
  ];
  for (const [re, rep] of swaps) variants.add(base.replace(re, rep));
  // primer nombre / primer apellido aislados
  const first = base.split(/\s+/)[0]; if (first) variants.add(first);
  return [...variants].filter(Boolean);
}

function buildSearches(p: any) {
  const out: { plataforma: string; url: string; query: string }[] = [];
  const nombres = (p.nombres ?? "").trim();
  const apellidos = (p.apellidos ?? "").trim();
  const apellido1 = apellidos.split(/\s+/)[0] ?? "";
  const nombre1 = nombres.split(/\s+/)[0] ?? "";
  const nac = p.nac_fecha ? new Date(p.nac_fecha).getUTCFullYear() : p.nac_rango_ini ?? null;
  const def = p.defuncion_fecha ? new Date(p.defuncion_fecha).getUTCFullYear() : null;
  const lugar = p.nac_lugar ?? p.residencia ?? "";

  // Margen amplio (±10 años) para tolerar fechas erróneas
  const range = nac ? `${nac - 10}..${nac + 10}` : "";

  out.push({ plataforma: "FamilySearch", query: `${nombres} ${apellidos}`,
    url: `https://www.familysearch.org/search/record/results?q.givenName=${enc(nombres)}&q.surname=${enc(apellidos)}${nac ? `&q.birthLikeDate.from=${nac-10}&q.birthLikeDate.to=${nac+10}` : ""}` });
  out.push({ plataforma: "MyHeritage", query: `${nombres} ${apellidos}`,
    url: `https://www.myheritage.es/research?formId=master&qname=Name+fnmo.${enc(nombres)}+lnmo.${enc(apellidos)}${nac ? `&qevents-event/-/start=Event+et.birth+ed.${nac}+ev.10` : ""}` });
  out.push({ plataforma: "Ancestry", query: `${nombres} ${apellidos}`,
    url: `https://www.ancestry.com/search/?name=${enc(nombres)}+${enc(apellido1)}${nac ? `&birth=${nac}` : ""}&name_x=1` });
  out.push({ plataforma: "Geneanet", query: `${nombres} ${apellido1}`,
    url: `https://en.geneanet.org/fonds/individus/?go=1&nom=${enc(apellido1)}&prenom=${enc(nombres)}${nac ? `&date_naissance=${nac}` : ""}` });
  out.push({ plataforma: "FindAGrave", query: `${nombres} ${apellido1}`,
    url: `https://www.findagrave.com/memorial/search?firstname=${enc(nombre1)}&lastname=${enc(apellido1)}${nac ? `&birthyear=${nac}&birthyearfilter=10` : ""}` });
  out.push({ plataforma: "WikiTree", query: `${nombre1} ${apellido1}`,
    url: `https://www.wikitree.com/wiki/Special:SearchPerson?first_name=${enc(nombre1)}&last_name=${enc(apellido1)}${nac ? `&birth_year=${nac}` : ""}` });
  out.push({ plataforma: "Archivo (Hispania/PARES)", query: `${nombres} ${apellidos}`,
    url: `https://pares.cultura.gob.es/pares/cgi-bin/Pares?ARES_BUSQUEDAS101=Filtro&Tipo=&Nombre=${enc(nombres + " " + apellidos)}` });

  // Buscadores generales — tolerantes a errores con OR de variantes
  const variantesNom = nameVariants(nombre1).slice(0, 3);
  const variantesApe = nameVariants(apellido1).slice(0, 3);
  const orQuery = variantesNom.flatMap(n => variantesApe.map(a => `"${n} ${a}"`)).join(" OR ");
  out.push({ plataforma: "Google (variantes)", query: orQuery,
    url: `https://www.google.com/search?q=${enc(`(${orQuery})${range ? ` ${range}` : ""}${lugar ? ` "${lugar}"` : ""} (genealogía OR ancestros OR partida OR bautismo)`)}` });
  out.push({ plataforma: "Bing", query: `${nombres} ${apellidos}`,
    url: `https://www.bing.com/search?q=${enc(`"${nombres} ${apellido1}"${range ? ` ${range}` : ""} genealogía`)}` });
  out.push({ plataforma: "DuckDuckGo", query: `${nombres} ${apellidos}`,
    url: `https://duckduckgo.com/?q=${enc(`"${nombre1} ${apellido1}"${range ? ` ${range}` : ""} (familytree OR genealogía OR árbol)`)}` });
  out.push({ plataforma: "Archive.org", query: `${apellido1}`,
    url: `https://archive.org/search.php?query=${enc(`${apellido1} ${nombre1}${nac ? ` ${nac}` : ""}`)}` });
  if (def) out.push({ plataforma: "Google — defunción", query: `${nombres} ${apellido1} defunción`,
    url: `https://www.google.com/search?q=${enc(`"${nombre1} ${apellido1}" (defunción OR obituario OR esquela) ${def-10}..${def+10}`)}` });
  return out;
}

function buildBroad(p: any) {
  const out: { plataforma: string; url: string; query: string }[] = [];
  const nombres = (p.nombres ?? "").trim();
  const apellidos = (p.apellidos ?? "").trim();
  const apellido1 = apellidos.split(/\s+/)[0] ?? "";
  const nombre1 = nombres.split(/\s+/)[0] ?? "";
  if (!nombre1 && !apellido1) return out;

  // Búsquedas SIN filtros — solo el nombre tal cual
  out.push({ plataforma: "Google (libre)", query: `${nombres} ${apellidos}`,
    url: `https://www.google.com/search?q=${enc(`${nombres} ${apellidos}`)}` });
  out.push({ plataforma: "Google (apellido)", query: apellido1,
    url: `https://www.google.com/search?q=${enc(`apellido ${apellido1} familia historia`)}` });
  out.push({ plataforma: "Google Images", query: `${nombres} ${apellidos}`,
    url: `https://www.google.com/search?tbm=isch&q=${enc(`${nombres} ${apellido1}`)}` });
  out.push({ plataforma: "Google Books", query: `${apellido1}`,
    url: `https://www.google.com/search?tbm=bks&q=${enc(`"${nombre1} ${apellido1}"`)}` });
  out.push({ plataforma: "Google Scholar", query: `${apellido1}`,
    url: `https://scholar.google.com/scholar?q=${enc(`"${nombre1} ${apellido1}" genealogía OR ancestry`)}` });
  out.push({ plataforma: "Wikipedia", query: `${nombres} ${apellidos}`,
    url: `https://es.wikipedia.org/w/index.php?search=${enc(`${nombres} ${apellido1}`)}` });
  out.push({ plataforma: "Internet Archive", query: `${apellido1}`,
    url: `https://archive.org/search.php?query=${enc(apellido1)}` });
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
