// Genera UNA curiosidad breve sobre una persona del árbol, usando contexto local
// (nombre, lugar, oficio, fechas). No inventa hechos no presentes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { pickAiTarget as _pickAiTarget, prepareEconomyChatBody as _prepareEconomyChatBody } from "../_shared/userAi.ts";

// === user-AI helper (auto-inyectado) ===
async function _aiFetch(req: Request, body: any) {
  const auth = req.headers.get("Authorization");
  const target = await _pickAiTarget(auth, body?.model);
  const finalBody = _prepareEconomyChatBody(body, target.model);
  return fetch(target.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${target.key}` },
    body: JSON.stringify(finalBody),
  });
}
// =======================================


const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("No autenticado");
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supa.auth.getUser();
    if (!user) throw new Error("Sesión inválida");

    const { persona_id } = await req.json();
    if (!persona_id) throw new Error("Falta persona_id");

    const { data: p } = await supa.from("personas").select("*").eq("id", persona_id).maybeSingle();
    if (!p) throw new Error("Persona no encontrada");

    // La key de OpenAI se decide en _aiFetch.

    const ctx = [
      `Nombre: ${p.nombres ?? ""} ${p.apellidos ?? ""}`,
      p.sexo && `Sexo: ${p.sexo}`,
      p.nacionalidad && `Nacionalidad: ${p.nacionalidad}`,
      p.nac_fecha && `Nacimiento: ${p.nac_fecha}`,
      p.defuncion_fecha && `Defunción: ${p.defuncion_fecha}`,
      p.ocupacion && `Oficio: ${p.ocupacion}`,
      p.religion && `Religión: ${p.religion}`,
    ].filter(Boolean).join("\n");

    const res = await _aiFetch(req, {
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: "Eres un historiador familiar. Devuelve UNA curiosidad breve (máx. 200 caracteres) de contexto histórico relevante para esta persona — por ejemplo qué pasaba en su país/oficio/religión en su año de nacimiento, o qué generación le tocó vivir. No inventes hechos personales. Responde solo el texto, sin comillas." },
        { role: "user", content: ctx || "Persona sin datos." },
      ],
    });
    if (!res.ok) throw new Error(`AI ${res.status}`);
    const j = await res.json();
    const curiosidad = j?.choices?.[0]?.message?.content?.trim() ?? null;

    return new Response(JSON.stringify({ curiosidad }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
