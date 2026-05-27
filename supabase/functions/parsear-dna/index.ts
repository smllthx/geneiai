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

    const { texto, fuente, rama, persona_id } = await req.json()
    if (!texto || String(texto).trim().length < 5) {
      return new Response(JSON.stringify({ error: 'Texto vacío' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const aiRes = await _aiFetch(req, {
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Extrae regiones étnicas y porcentajes de tests de ADN (MyHeritage, AncestryDNA, 23andMe, FTDNA, LivingDNA). Responde SOLO JSON.' },
          { role: 'user', content: `Texto del reporte:\n\n${String(texto).slice(0, 12000)}\n\nDevuelve JSON: { "items": [{ "region": string, "porcentaje": number }] }. Normaliza nombres (ej. "Iberian" → "Ibérico (España/Portugal)"). Excluye totales y porcentajes 0.` },
        ],
        response_format: { type: 'json_object' },
    })
    if (!aiRes.ok) {
      const t = await aiRes.text()
      return new Response(JSON.stringify({ error: `AI ${aiRes.status}: ${t}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const ai = await aiRes.json()
    let parsed: any = { items: [] }
    try { parsed = JSON.parse(ai.choices[0].message.content) } catch {}
    const items = (parsed.items ?? []).filter((i: any) => i.region && typeof i.porcentaje === 'number')

    if (items.length === 0) {
      return new Response(JSON.stringify({ insertados: 0, items: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const rows = items.map((i: any) => ({
      user_id: user.id,
      persona_id: persona_id ?? null,
      region: String(i.region).slice(0, 200),
      porcentaje: Number(i.porcentaje),
      fuente: fuente ?? 'MyHeritage DNA (importado)',
      rama: rama ?? null,
    }))
    const { error } = await supa.from('dna_estimates').insert(rows)
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ insertados: rows.length, items: rows }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
