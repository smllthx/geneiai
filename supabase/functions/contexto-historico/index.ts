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
    if (!user) return new Response(JSON.stringify({ error: 'no auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { persona_id } = await req.json()
    const { data: p } = await supa.from('personas').select('*').eq('id', persona_id).maybeSingle()
    if (!p) return new Response(JSON.stringify({ error: 'persona no encontrada' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const lugaresIds = [p.nac_lugar_id, p.defuncion_lugar_id, p.matrimonio_lugar_id, p.bautismo_lugar_id, p.entierro_lugar_id].filter(Boolean)
    const { data: lugares } = await supa.from('lugares').select('id,ciudad,provincia,region,pais').in('id', lugaresIds.length ? lugaresIds : ['00000000-0000-0000-0000-000000000000'])
    const lugaresTxt = (lugares ?? []).map((l: any) => [l.ciudad, l.provincia, l.region, l.pais].filter(Boolean).join(', ')).join(' · ') || 'lugares desconocidos'

    const nac = p.nac_fecha ? new Date(p.nac_fecha).getUTCFullYear() : (p.nac_rango_ini ?? null)
    const fin = p.defuncion_fecha ? new Date(p.defuncion_fecha).getUTCFullYear() : null
    const periodo = nac && fin ? `${nac}–${fin}` : nac ? `desde ${nac}` : 'periodo desconocido'

    const prompt = `Resume el contexto histórico, social, económico, político y cultural relevante durante la vida de ${p.nombres} ${p.apellidos} (${periodo}) en ${lugaresTxt}.
${p.ocupacion ? `Ocupación: ${p.ocupacion}.` : ''}
${p.nacionalidad ? `Nacionalidad: ${p.nacionalidad}.` : ''}

Entrega 6 a 10 puntos cortos en formato JSON: { "puntos": [{ "anio": número o rango, "titulo": string, "detalle": string, "categoria": "politica"|"economia"|"guerra"|"migracion"|"cultura"|"tecnologia"|"epidemia"|"local" }] }.
Prioriza hechos locales/regionales por sobre globales. En español. Sin emojis.`

    const aiRes = await _aiFetch(req, {
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Eres historiador genealogista. Responde SOLO con JSON válido.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
    })
    if (!aiRes.ok) {
      const t = await aiRes.text()
      return new Response(JSON.stringify({ error: `AI ${aiRes.status}: ${t}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const ai = await aiRes.json()
    let parsed: any = {}
    try { parsed = JSON.parse(ai.choices[0].message.content) } catch { parsed = { puntos: [] } }

    return new Response(JSON.stringify({ puntos: parsed.puntos ?? [], periodo, lugares: lugaresTxt }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
