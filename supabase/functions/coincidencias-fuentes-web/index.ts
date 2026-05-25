// Busca coincidencias de una persona en fuentes web (FamilySearch, MyHeritage,
// archivos.gob, GenealogyBank, etc.) usando IA con búsqueda libre.
// Crea sugerencias tipo 'fuente' que el usuario puede aceptar.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
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
    const auth = req.headers.get('Authorization') ?? ''
    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    })
    const { data: { user } } = await supa.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'no auth' }), { status: 401, headers: corsHeaders })

    const { persona_id } = await req.json().catch(() => ({}))
    if (!persona_id) return new Response(JSON.stringify({ error: 'persona_id requerido' }), { status: 400, headers: corsHeaders })

    const { data: p } = await supa.from('personas').select('*').eq('id', persona_id).eq('user_id', user.id).maybeSingle()
    if (!p) return new Response(JSON.stringify({ error: 'persona no encontrada' }), { status: 404, headers: corsHeaders })

    const aiKey = Deno.env.get('LOVABLE_API_KEY')!
    const ctx = `Nombre: ${p.nombres} ${p.apellidos}\nNac: ${p.nac_fecha ?? p.nac_fecha_aprox ?? '?'}\nDef: ${p.defuncion_fecha ?? '?'}\nNacionalidad/origen: ${p.nacionalidad ?? '?'}\nVariantes nombre: ${(p.variantes_nombre ?? []).join(', ')}`

    const sys = `Eres detective genealógico experto en bases de datos online (FamilySearch, MyHeritage, Geneanet, Ancestry, archivos parroquiales y civiles europeos y americanos, hemerotecas digitales).
Dado el perfil de una persona, propones entre 3 y 8 coincidencias plausibles indicando plataforma, URL pública estimada, tipo de fuente y por qué crees que coincide.
Considera variantes ortográficas históricas (italiano antiguo, alemán Fraktur, español colonial 1700-1900).
No inventes URLs cerradas: usa URLs raíz de búsqueda si no conoces el registro exacto.`;

    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${aiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{ role: 'system', content: sys }, { role: 'user', content: ctx }],
        tools: [{
          type: 'function',
          function: {
            name: 'coincidencias_web',
            parameters: {
              type: 'object',
              properties: {
                coincidencias: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      plataforma: { type: 'string' },
                      tipo: { type: 'string', description: 'p. ej. acta bautismal, censo, esquela, árbol público' },
                      titulo: { type: 'string' },
                      url: { type: 'string' },
                      por_que: { type: 'string' },
                      confianza: { type: 'integer', minimum: 0, maximum: 100 },
                    },
                    required: ['plataforma', 'titulo', 'url', 'por_que', 'confianza'],
                  },
                },
              },
              required: ['coincidencias'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'coincidencias_web' } },
      }),
    })
    if (!r.ok) return new Response(JSON.stringify({ error: 'gateway' }), { status: 500, headers: corsHeaders })
    const j = await r.json()
    let parsed: any = { coincidencias: [] }
    try { parsed = JSON.parse(j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? '{}') } catch (_) {}

    const filas = (parsed.coincidencias ?? []).map((c: any) => ({
      user_id: user.id,
      persona_id,
      tipo: 'fuente',
      tipo_externo: c.plataforma,
      url_externa: c.url,
      titulo: `${c.plataforma}: ${c.titulo}`.slice(0, 200),
      descripcion: c.por_que,
      confianza: c.confianza ?? 60,
      origen: 'coincidencias-fuentes-web',
      payload: c,
    }))
    let creadas = 0
    if (filas.length) {
      const { error } = await supa.from('sugerencias').insert(filas)
      if (!error) creadas = filas.length
    }
    return new Response(JSON.stringify({ creadas, total: filas.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders })
  }
})
