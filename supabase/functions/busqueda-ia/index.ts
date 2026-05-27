// Búsqueda IA unificada: 3 modos (persona / manual / url).
// - Genera consultas inteligentes con variantes ortográficas, lugares, épocas
// - Busca en DuckDuckGo + Wikipedia (sin API keys)
// - Lee páginas con Firecrawl si está disponible, si no con fetch + limpieza HTML
// - Analiza con OpenAI/ChatGPT para extraer nombres/fechas/lugares/relaciones + confianza
// - Guarda como `sugerencias` (tipo "hallazgo_ia") asociadas a la persona si aplica
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { pickAiTarget as _pickAiTarget } from "../_shared/userAi.ts";

// === user-AI helper (auto-inyectado) ===
async function _aiFetch(req: Request, body: any) {
  const auth = req.headers.get("Authorization");
  const target = await _pickAiTarget(auth, body?.model);
  const finalBody = { ...body, model: target.model };
  return fetch(target.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${target.key}` },
    body: JSON.stringify(finalBody),
  });
}
// =======================================


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const UA = "Mozilla/5.0 (compatible; GeneAIAgent/1.0)";

type Hit = { titulo: string; url: string; snippet: string; fuente: string };

async function ddg(q: string, limit = 6): Promise<Hit[]> {
  try {
    const r = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`, { headers: { "User-Agent": UA } });
    const html = await r.text();
    const out: Hit[] = [];
    const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && out.length < limit) {
      const title = m[2].replace(/<[^>]+>/g, "").trim();
      const snip = m[3].replace(/<[^>]+>/g, "").trim();
      let href = m[1];
      try { const u = new URL(href, "https://duckduckgo.com"); href = decodeURIComponent(u.searchParams.get("uddg") ?? u.toString()); } catch {}
      out.push({ titulo: title, url: href, snippet: snip, fuente: "duckduckgo" });
    }
    return out;
  } catch { return []; }
}

async function wikipedia(q: string, limit = 3): Promise<Hit[]> {
  try {
    const r = await fetch(`https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=${limit}&origin=*`, { headers: { "User-Agent": UA } });
    const j = await r.json();
    return (j.query?.search ?? []).map((s: any) => ({
      titulo: s.title,
      url: `https://es.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, "_"))}`,
      snippet: (s.snippet ?? "").replace(/<[^>]+>/g, ""),
      fuente: "wikipedia",
    }));
  } catch { return []; }
}

async function fetchPageText(url: string, maxChars = 8000): Promise<{ text: string; title?: string }> {
  const FC = Deno.env.get("FIRECRAWL_API_KEY");
  if (FC) {
    try {
      const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FC}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      });
      const j = await r.json();
      const md: string = j.markdown ?? j.data?.markdown ?? "";
      return { text: md.slice(0, maxChars), title: j.metadata?.title ?? j.data?.metadata?.title };
    } catch {}
  }
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return { text: "" };
    const html = await r.text();
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return { text: text.slice(0, maxChars), title };
  } catch { return { text: "" }; }
}

async function ai(req: Request, messages: any[], tool?: any, model = "openai/gpt-4o-mini") {
  const body: any = { model, messages };
  if (tool) { body.tools = [tool]; body.tool_choice = { type: "function", function: { name: tool.function.name } }; }
  const r = await _aiFetch(req, body);
  if (r.status === 429) throw new Error("rate_limited");
  if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
  const j = await r.json();
  if (tool) {
    const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    return args ? JSON.parse(args) : null;
  }
  return j.choices?.[0]?.message?.content ?? "";
}

const HALLAZGO_TOOL = (multi = true) => ({
  type: "function",
  function: {
    name: "guardar_hallazgos",
    description: "Lista de hallazgos analizados desde fuentes web.",
    parameters: {
      type: "object",
      properties: {
        hallazgos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              titulo: { type: "string" },
              fuente: { type: "string", description: "wikipedia, duckduckgo, familysearch, periódico, etc." },
              url: { type: "string" },
              resumen: { type: "string" },
              personas: { type: "array", items: { type: "string" }, description: "Nombres detectados" },
              fechas: { type: "array", items: { type: "string" } },
              lugares: { type: "array", items: { type: "string" } },
              motivo: { type: "string", description: "Por qué podría estar relacionado" },
              confianza: { type: "string", enum: ["alta", "media", "baja"] },
            },
            required: ["titulo", "url", "resumen", "confianza"],
          },
        },
      },
      required: ["hallazgos"],
    },
  },
});

function slug(s: string) { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

function variantesApellido(a: string): string[] {
  const v = new Set([a]);
  v.add(a.replace(/tt/gi, "t")); v.add(a.replace(/t/gi, "tt"));
  v.add(a.replace(/ü/gi, "u")); v.add(a.replace(/sch/gi, "sh"));
  v.add(a.replace(/c/gi, "z")); v.add(a.replace(/z/gi, "c"));
  return Array.from(v).filter(Boolean);
}

async function modoPersona(req: Request, sb: any, userId: string, personaId: string) {
  const { data: p } = await sb.from("personas").select("*").eq("user_id", userId).eq("id", personaId).maybeSingle();
  if (!p) throw new Error("Persona no encontrada");
  const [{ data: rels }, { data: evs }] = await Promise.all([
    sb.from("relaciones").select("tipo, personas:pariente_id(nombres, apellidos)").eq("persona_id", personaId).limit(30),
    sb.from("eventos").select("tipo, fecha, fecha_aprox, lugar_original").eq("persona_id", personaId).limit(30),
  ]);
  const apellidos = (p.apellidos ?? "").split(/\s+/);
  const variantes = apellidos.flatMap(variantesApellido);
  const lugares = (evs ?? []).map((e: any) => e.lugar_original).filter(Boolean);
  const anos: string[] = [];
  if (p.nac_fecha) anos.push(String(new Date(p.nac_fecha).getFullYear()));
  if (p.defuncion_fecha) anos.push(String(new Date(p.defuncion_fecha).getFullYear()));
  const queries = [
    `"${p.nombres} ${p.apellidos}" genealogía`,
    `"${p.nombres} ${p.apellidos}" ${anos[0] ?? ""} ${lugares[0] ?? ""}`.trim(),
    `${variantes.join(" OR ")} ${p.nombres} familia`,
    `"${p.apellidos}" ${lugares.join(" ")} acta partida`,
    `${p.nombres} ${p.apellidos} cementerio lápida`,
    `${p.nombres} ${p.apellidos} inmigración pasajeros`,
  ].filter((q) => q.trim().length > 5);

  const todos: Hit[] = [];
  for (const q of queries.slice(0, 5)) {
    const [a, b] = await Promise.all([ddg(q, 4), wikipedia(q, 2)]);
    todos.push(...a, ...b);
  }
  const dedup = Array.from(new Map(todos.map((h) => [h.url, h])).values()).slice(0, 18);

  const ctx = { persona: { nombre: `${p.nombres} ${p.apellidos}`, nac: p.nac_fecha, def: p.defuncion_fecha, nacionalidad: p.nacionalidad }, familiares: (rels ?? []).map((r: any) => `${r.tipo}: ${r.personas?.nombres ?? ""} ${r.personas?.apellidos ?? ""}`), eventos: evs ?? [] };
  const out = await ai(req, [
    { role: "system", content: "Eres asistente genealógico. Analiza los resultados web y devuelve hallazgos relevantes con confianza (alta/media/baja). Sé conservador: si no menciona la persona, baja. Explica el motivo." },
    { role: "user", content: `Contexto persona:\n${JSON.stringify(ctx)}\n\nResultados web:\n${JSON.stringify(dedup)}` },
  ], HALLAZGO_TOOL());
  return { hallazgos: out?.hallazgos ?? [], persona: p };
}

async function modoManual(req: Request, _sb: any, _userId: string, params: any) {
  const { nombres = "", apellidos = "", lugar = "", anos = "", palabras = "" } = params ?? {};
  const q = [nombres, apellidos, lugar, anos, palabras].filter(Boolean).join(" ");
  if (!q) throw new Error("Parámetros vacíos");
  const queries = [q, `"${nombres} ${apellidos}" ${lugar} genealogía`, `${apellidos} ${lugar} ${anos} acta partida`, `${nombres} ${apellidos} cementerio`].filter((x) => x.trim().length > 3);
  const todos: Hit[] = [];
  for (const x of queries.slice(0, 4)) { const [a, b] = await Promise.all([ddg(x, 4), wikipedia(x, 2)]); todos.push(...a, ...b); }
  const dedup = Array.from(new Map(todos.map((h) => [h.url, h])).values()).slice(0, 16);
  const out = await ai(req, [
    { role: "system", content: "Eres asistente genealógico. A partir de resultados web y unos parámetros de búsqueda manual, devuelve hallazgos ordenados por relevancia con confianza alta/media/baja." },
    { role: "user", content: `Parámetros:\n${JSON.stringify(params)}\n\nResultados:\n${JSON.stringify(dedup)}` },
  ], HALLAZGO_TOOL());
  return { hallazgos: out?.hallazgos ?? [] };
}

async function modoUrl(req: Request, sb: any, userId: string, url: string) {
  if (!/^https?:\/\//i.test(url)) throw new Error("URL inválida");
  const { text, title } = await fetchPageText(url, 9000);
  if (!text) throw new Error("No se pudo leer la página");
  const { data: personas } = await sb.from("personas").select("id, nombres, apellidos, nac_fecha, defuncion_fecha").eq("user_id", userId).limit(2000);
  const out = await ai(req, [
    { role: "system", content: "Eres asistente genealógico. Analiza la página, extrae nombres, fechas, lugares y relaciones; comparándolas con el árbol del usuario propone coincidencias. Devuelve hallazgos con confianza." },
    { role: "user", content: `URL: ${url}\nTítulo: ${title ?? ""}\n\nCONTENIDO:\n${text}\n\nÁRBOL (id|nombre|nac|def):\n${(personas ?? []).slice(0, 800).map((p: any) => `${p.id}|${p.nombres} ${p.apellidos}|${p.nac_fecha ?? ""}|${p.defuncion_fecha ?? ""}`).join("\n")}` },
  ], HALLAZGO_TOOL());
  return { hallazgos: out?.hallazgos ?? [], pagina: { url, titulo: title } };
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

    const body = await req.json().catch(() => ({}));
    const modo: "persona" | "manual" | "url" = body.modo;
    let result: any;
    let personaId: string | null = body.persona_id ?? null;
    if (modo === "persona") result = await modoPersona(req, sb, user.id, body.persona_id);
    else if (modo === "manual") result = await modoManual(req, sb, user.id, body);
    else if (modo === "url") result = await modoUrl(req, sb, user.id, body.url);
    else throw new Error("modo inválido (persona|manual|url)");

    const hallazgos: any[] = result.hallazgos ?? [];
    if (hallazgos.length) {
      await sb.from("sugerencias").insert(hallazgos.map((h) => ({
        user_id: user.id,
        persona_id: personaId,
        tipo: "hallazgo_ia",
        titulo: String(h.titulo ?? "Hallazgo").slice(0, 200),
        descripcion: h.resumen ?? null,
        origen: h.fuente ?? modo,
        tipo_externo: h.fuente ?? modo,
        url_externa: h.url ?? null,
        confianza: h.confianza === "alta" ? 85 : h.confianza === "media" ? 60 : 35,
        payload: { motivo: h.motivo, personas: h.personas, fechas: h.fechas, lugares: h.lugares, modo },
      })));
    }
    await sb.from("notificaciones").insert({
      user_id: user.id, titulo: "Búsqueda IA finalizada",
      mensaje: `Modo ${modo} · ${hallazgos.length} hallazgo(s).`,
      tipo: "ia", url: personaId ? `/personas/${personaId}` : "/busqueda-ia",
    });

    return new Response(JSON.stringify({ ok: true, modo, hallazgos, persona: result.persona ?? null, pagina: result.pagina ?? null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("busqueda-ia", e);
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "rate_limited" ? 429 : 400;
    return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
