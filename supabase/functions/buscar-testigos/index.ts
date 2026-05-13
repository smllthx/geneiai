// Buscar testigos — recorre todos los documentos del usuario y busca menciones
// (en titulo + transcripcion + ocr_texto) de las personas del árbol. Crea
// coincidencias internas para revisión manual.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const norm = (s: string) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function nameTokens(p: { nombres: string; apellidos: string; variantes_nombre?: string[] | null }): string[] {
  const tokens = new Set<string>();
  // Apellidos: cada palabra >= 4 chars
  for (const w of norm(p.apellidos).split(" ")) if (w.length >= 4) tokens.add(w);
  // Nombre + apellido completo
  const full = norm(`${p.nombres} ${p.apellidos}`);
  if (full.length >= 6) tokens.add(full);
  // Variantes
  for (const v of p.variantes_nombre ?? []) {
    const nv = norm(v);
    if (nv.length >= 4) tokens.add(nv);
  }
  return [...tokens];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const [{ data: personas }, { data: documentos }] = await Promise.all([
      supabase.from("personas").select("id, nombres, apellidos, variantes_nombre"),
      supabase.from("documentos").select("id, titulo, transcripcion, ocr_texto, personas_mencionadas"),
    ]);

    const personasArr = personas ?? [];
    const docsArr = documentos ?? [];

    const newCoincidencias: Array<{ user_id: string; ref_a: string; ref_b: string; tipo: string; score: number; razones: any; estado: string }> = [];
    const docUpdates: Array<{ id: string; personas_mencionadas: string[] }> = [];

    // Pre-compute tokens per persona
    const personaTokens = personasArr.map((p) => ({ p, tokens: nameTokens(p as any) }));

    for (const doc of docsArr) {
      const haystack = norm([doc.titulo, doc.transcripcion, doc.ocr_texto].filter(Boolean).join(" "));
      if (!haystack) continue;

      const found = new Set<string>(doc.personas_mencionadas ?? []);
      const matchedThisDoc: Array<{ persona_id: string; token: string; score: number }> = [];

      for (const { p, tokens } of personaTokens) {
        for (const tok of tokens) {
          if (haystack.includes(tok)) {
            const score = tok.includes(" ") ? 90 : 60; // nombre+apellido pesa más
            matchedThisDoc.push({ persona_id: p.id, token: tok, score });
            found.add(p.id);
            break;
          }
        }
      }

      if (matchedThisDoc.length) {
        docUpdates.push({ id: doc.id, personas_mencionadas: [...found] });
        for (const m of matchedThisDoc) {
          newCoincidencias.push({
            user_id: user.id,
            ref_a: m.persona_id,
            ref_b: doc.id,
            tipo: "persona_documento",
            score: m.score,
            razones: [{ token_encontrado: m.token, en_documento: doc.titulo }],
            estado: "pendiente",
          });
        }
      }
    }

    // Apply
    let coinsCreadas = 0;
    if (newCoincidencias.length) {
      const { error, count } = await supabase.from("coincidencias").insert(newCoincidencias, { count: "exact" });
      if (error) console.error("coincidencias insert", error);
      else coinsCreadas = count ?? newCoincidencias.length;
    }
    let docsActualizados = 0;
    for (const u of docUpdates) {
      const { error } = await supabase.from("documentos").update({ personas_mencionadas: u.personas_mencionadas }).eq("id", u.id);
      if (!error) docsActualizados++;
    }

    return new Response(JSON.stringify({
      personas_evaluadas: personasArr.length,
      documentos_evaluados: docsArr.length,
      coincidencias_creadas: coinsCreadas,
      documentos_actualizados: docsActualizados,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("buscar-testigos error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
