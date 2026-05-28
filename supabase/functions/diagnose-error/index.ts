// Diagnostica errores reportados por la app y sugiere una acción de auto-reparación.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
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


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { message, stack, url, user_agent, contexto } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "message requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = `Eres un ingeniero de soporte de una PWA React. Analiza el error y devuelve JSON con:
- diagnosis: 1-2 frases técnicas claras en español
- severity: "low" | "medium" | "high"
- suggested_action: uno de ["reload", "clear-cache", "clear-storage", "reset-sw", "relogin", "none"]
- user_message: mensaje amable para el usuario en español (1-2 frases) explicando qué pasó y qué se va a hacer
- requires_restart: boolean (si conviene cerrar y abrir la app)
Responde SOLO el JSON, sin markdown.`;

    const user = `Error: ${message}
URL: ${url || "?"}
UA: ${user_agent || "?"}
Stack:
${(stack || "").slice(0, 2000)}
Contexto: ${JSON.stringify(contexto || {}).slice(0, 1000)}`;

    const r = await _aiFetch(req, {
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
    });

    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: "ai", detail: t }), {
        status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await r.json();
    let parsed: any = {};
    try { parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}"); } catch { parsed = {}; }

    const out = {
      diagnosis: parsed.diagnosis ?? "No se pudo diagnosticar automáticamente.",
      severity: parsed.severity ?? "medium",
      suggested_action: parsed.suggested_action ?? "reload",
      user_message: parsed.user_message ?? "Detectamos un fallo. Vamos a aplicar una reparación y reiniciar la app.",
      requires_restart: parsed.requires_restart ?? true,
    };

    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
