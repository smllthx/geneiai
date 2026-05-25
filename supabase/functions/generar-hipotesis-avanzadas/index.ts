// Genera hipótesis genealógicas avanzadas escaneando todo el árbol del usuario.
// Usa Lovable AI con tool calling para producir hipótesis con probabilidad,
// argumentos a favor / en contra y próxima acción sugerida. Las guarda en `hipotesis`.
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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM = `Eres un investigador genealógico experto.
Analiza el árbol completo del usuario y genera entre 5 y 12 hipótesis genealógicas avanzadas y útiles.
Cada hipótesis debe ser concreta, basada en los datos provistos (no inventes nombres). Ejemplos:
- "Posible padre/madre faltante de X dado el apellido y el patrón regional"
- "Posibles medio-hermanos/as detectados por solapamiento de padres"
- "Migración familiar probable desde Y hacia Z entre fechas A-B"
- "Endogamia o repetición de nombres que sugiere parentesco previo"
- "Duplicado probable: dos personas que podrían ser la misma"
- "Padrino/madrina coincide con un familiar conocido"
Sé conservador con la probabilidad: 30-60 para conjeturas, 60-85 para evidencia indirecta sólida.
Responde SOLO usando la herramienta proporcionada.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY no configurada");

    const auth = req.headers.get("Authorization") ?? "";
    const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser();
    const user = u.user;
    if (!user) return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Carga compacta del árbol
    const [{ data: personas }, { data: relaciones }, { data: eventos }] = await Promise.all([
      sb.from("personas").select("id,nombres,apellidos,sexo,nac_fecha,nac_fecha_aprox,defuncion_fecha,nacionalidad,ocupacion").limit(2000),
      sb.from("relaciones").select("persona_id,pariente_id,tipo,naturaleza").limit(8000),
      sb.from("eventos").select("persona_id,tipo,fecha,fecha_aprox,lugar_original").limit(4000),
    ]);

    if (!personas?.length) {
      return new Response(JSON.stringify({ ok: true, creadas: 0, motivo: "Árbol vacío" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctx = {
      personas: personas.map((p) => ({
        id: p.id, n: `${p.nombres} ${p.apellidos}`, s: p.sexo,
        nac: p.nac_fecha ?? p.nac_fecha_aprox, def: p.defuncion_fecha,
        pais: p.nacionalidad, ocu: p.ocupacion,
      })),
      relaciones: (relaciones ?? []).map((r) => ({ p: r.persona_id, q: r.pariente_id, t: r.tipo, nat: r.naturaleza })),
      eventos: (eventos ?? []).map((e) => ({ p: e.persona_id, t: e.tipo, f: e.fecha ?? e.fecha_aprox, l: e.lugar_original })),
    };

    const aiRes = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Árbol del usuario (IDs estables). Genera hipótesis:\n${JSON.stringify(ctx)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "guardar_hipotesis",
            description: "Devuelve la lista de hipótesis avanzadas.",
            parameters: {
              type: "object",
              properties: {
                hipotesis: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      titulo: { type: "string" },
                      descripcion: { type: "string" },
                      probabilidad: { type: "integer", minimum: 5, maximum: 95 },
                      argumentos_favor: { type: "string" },
                      argumentos_contra: { type: "string" },
                      proxima_accion: { type: "string" },
                      personas: { type: "array", items: { type: "string" } },
                    },
                    required: ["titulo", "descripcion", "probabilidad", "personas"],
                  },
                },
              },
              required: ["hipotesis"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "guardar_hipotesis" } },
      }),
    });
    if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Límite alcanzado" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Sin créditos de IA" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiRes.ok) throw new Error(`AI ${aiRes.status}: ${await aiRes.text()}`);
    const j = await aiRes.json();
    const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { hipotesis: [] };
    const valid = new Set(personas.map((p) => p.id));

    const rows = (parsed.hipotesis ?? []).map((h: any) => ({
      user_id: user.id,
      titulo: String(h.titulo ?? "").slice(0, 200) || "Hipótesis",
      descripcion: h.descripcion ?? null,
      probabilidad: Math.max(5, Math.min(95, Number(h.probabilidad) || 50)),
      argumentos_favor: h.argumentos_favor ?? null,
      argumentos_contra: h.argumentos_contra ?? null,
      proxima_accion: h.proxima_accion ?? null,
      personas: (h.personas ?? []).filter((id: string) => valid.has(id)),
    }));

    if (rows.length) await sb.from("hipotesis").insert(rows);
    await sb.from("notificaciones").insert({
      user_id: user.id, titulo: "Hipótesis IA generadas", tipo: "ia",
      mensaje: `Se crearon ${rows.length} hipótesis genealógicas avanzadas.`,
      url: "/insights",
    });

    return new Response(JSON.stringify({ ok: true, creadas: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generar-hipotesis-avanzadas", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
