// Búsqueda web LIBRE usando DuckDuckGo HTML + Wikipedia + OpenAI/ChatGPT para resumir.
// Genera sugerencias_externas con citas reales para una persona del árbol.
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

type Hit = { titulo: string; url: string; snippet: string; fuente: string };

const UA = "Mozilla/5.0 (compatible; GenaiaBot/1.0)";

async function ddg(q: string, limit = 8): Promise<Hit[]> {
  try {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    const html = await r.text();
    const out: Hit[] = [];
    const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && out.length < limit) {
      const raw = m[1];
      const title = m[2].replace(/<[^>]+>/g, "").trim();
      const snip = m[3].replace(/<[^>]+>/g, "").trim();
      let href = raw;
      try {
        const u = new URL(raw, "https://duckduckgo.com");
        href = u.searchParams.get("uddg") ?? u.toString();
        href = decodeURIComponent(href);
      } catch { /* ignore */ }
      out.push({ titulo: title, url: href, snippet: snip, fuente: "duckduckgo" });
    }
    return out;
  } catch { return []; }
}

async function wikipedia(q: string, limit = 4): Promise<Hit[]> {
  try {
    const r = await fetch(
      `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=${limit}&origin=*`,
      { headers: { "User-Agent": UA } },
    );
    const j = await r.json();
    return (j.query?.search ?? []).map((s: any) => ({
      titulo: s.title,
      url: `https://es.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, "_"))}`,
      snippet: (s.snippet ?? "").replace(/<[^>]+>/g, ""),
      fuente: "wikipedia",
    }));
  } catch { return []; }
}

async function fetchText(url: string, maxChars = 4000): Promise<string> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return "";
    const html = await r.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, maxChars);
  } catch { return ""; }
}

async function openAISummary(req: Request, prompt: string): Promise<string> {
  try {
    const r = await _aiFetch(req, {
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: "Eres asistente genealógico. Responde en JSON conciso." },
          { role: "user", content: prompt },
        ],
    });
    const j = await r.json();
    return j.choices?.[0]?.message?.content ?? "";
  } catch { return ""; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("No autenticado");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser();
    if (!u.user) throw new Error("Sesión inválida");

    const { persona_id } = await req.json();
    if (!persona_id) throw new Error("Falta persona_id");

    const { data: p } = await sb.from("personas").select("*").eq("id", persona_id).maybeSingle();
    if (!p) throw new Error("Persona no encontrada");

    const full = `${p.nombres ?? ""} ${p.apellidos ?? ""}`.trim();
    const yN = p.nac_fecha ? new Date(p.nac_fecha).getUTCFullYear() : p.nac_rango_ini ?? "";
    const yD = p.defuncion_fecha ? new Date(p.defuncion_fecha).getUTCFullYear() : "";
    const lugar = p.nac_lugar ?? p.defuncion_lugar ?? "";

    const queries = [
      `"${full}" genealogía ${lugar}`.trim(),
      `"${full}" ${yN || ""} ${lugar}`.trim(),
      `"${full}" partida nacimiento ${lugar}`.trim(),
      `"${full}" defunción ${yD || lugar}`.trim(),
    ].filter((q) => q.replace(/"/g, "").trim().length > 4);

    const results: Hit[] = [];
    for (const q of queries) {
      const [a, b] = await Promise.all([ddg(q, 5), wikipedia(q, 2)]);
      results.push(...a, ...b);
    }
    // Dedup
    const seen = new Set<string>();
    const unique = results.filter((h) => !seen.has(h.url) && seen.add(h.url)).slice(0, 12);

    // Fetch & summarize top 3
    const top = unique.slice(0, 3);
    let insight = "";
    if (top.length) {
      const blobs = await Promise.all(top.map(async (h) => ({
        url: h.url,
        titulo: h.titulo,
        text: await fetchText(h.url, 2500),
      })));
      const prompt = `Persona: ${full} (${yN || "?"}–${yD || "?"}) ${lugar}.\n` +
        `Extrae datos genealógicos verificables (fechas, lugares, padres, cónyuges, hijos, ocupación) de estos extractos web. ` +
        `Responde JSON: {"hallazgos":[{"dato":"...","cita":"url"}],"resumen":"..."}.\n\n` +
        blobs.map((b) => `[${b.url}]\n${b.text}`).join("\n\n---\n\n");
      insight = await openAISummary(req, prompt);
    }

    // Persist as sugerencias (tipo: web_libre)
    const rows = unique.map((h) => ({
      user_id: u.user.id,
      persona_id: persona_id,
      tipo: "web_externa",
      tipo_externo: h.fuente,
      titulo: h.titulo.slice(0, 240),
      descripcion: h.snippet.slice(0, 600),
      url_externa: h.url.slice(0, 1000),
      origen: "web-search-libre",
      confianza: h.fuente === "wikipedia" ? 75 : 55,
      payload: { snippet: h.snippet, fuente: h.fuente },
    }));
    let inserted = 0;
    if (rows.length) {
      const { data } = await sb.from("sugerencias").insert(rows).select("id");
      inserted = data?.length ?? 0;
    }


    if (insight) {
      await sb.from("notificaciones").insert({
        user_id: u.user.id,
        titulo: `Web libre: ${full}`,
        mensaje: `${inserted} resultados web · resumen IA disponible`,
        tipo: "info",
        url: `/personas/${persona_id}`,
      });
    }

    return new Response(JSON.stringify({ ok: true, sugerencias: inserted, hits: unique.length, insight }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
