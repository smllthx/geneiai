// Devuelve variantes multilingües de nombres/apellidos según el origen.
// La IA actúa como experta lingüista en es/it/de/en (incluyendo formas antiguas 1700-2025).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
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


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { nombres = '', apellidos = '', origen = '', nacionalidad = '' } = await req.json().catch(() => ({}))
    if (!String(nombres).trim() && !String(apellidos).trim()) {
      return new Response(JSON.stringify({ variantes: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const aiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!aiKey) return new Response(JSON.stringify({ error: 'no key' }), { status: 500, headers: corsHeaders })

    const ctxOrigen = [origen, nacionalidad].filter(Boolean).join(' / ') || 'desconocido'

    const sys = `Eres lingüista experta en onomástica histórica europea (1700-2025) en español, italiano, alemán e inglés.
Dado un nombre completo y su origen/nacionalidad, devuelve las variantes equivalentes en los 4 idiomas (es, it, de, en).
Reglas:
- Si el origen sugiere italiano (apellido o nacionalidad), MARCA "it" como principal.
- Idem para de/en/es.
- Para apellidos: incluye grafías históricas comunes (p. ej. ä↔ae, ñ↔n, doble s↔ß, sufijos -ez/-es, -ini/-ino, -mann/-man).
- Para nombres: usa el equivalente real (Juan↔Giovanni↔Johann↔John; María↔Maria↔Marie↔Mary; Pedro↔Pietro↔Peter↔Peter; etc.).
- No inventes apellidos sin equivalente: si no hay forma idiomática, mantén el original.
- Devuelve siempre las 4 variantes (es, it, de, en).`;

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${aiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: `Nombres: ${nombres}\nApellidos: ${apellidos}\nOrigen: ${ctxOrigen}` },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'variantes_nombre',
            parameters: {
              type: 'object',
              properties: {
                principal: { type: 'string', enum: ['es', 'it', 'de', 'en'], description: 'Idioma principal según el origen' },
                variantes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      idioma: { type: 'string', enum: ['es', 'it', 'de', 'en'] },
                      nombres: { type: 'string' },
                      apellidos: { type: 'string' },
                      notas: { type: 'string', description: 'p. ej. forma antigua, grafía latinizada' },
                    },
                    required: ['idioma', 'nombres', 'apellidos'],
                  },
                },
              },
              required: ['principal', 'variantes'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'variantes_nombre' } },
      }),
    })
    if (!res.ok) {
      const t = await res.text()
      return new Response(JSON.stringify({ error: 'gateway', detail: t }), { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const j = await res.json()
    const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
    let out: any = { principal: 'es', variantes: [] }
    try { out = JSON.parse(args) } catch (_) {}
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
