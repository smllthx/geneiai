import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
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


function norm(s: string) {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = req.headers.get('Authorization') ?? ''
    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    })
    const { data: { user } } = await supa.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'no auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: personas } = await supa.from('personas').select('id,nombres,apellidos,nac_fecha,nac_rango_ini,sexo,variantes_nombre')
    if (!personas) return new Response(JSON.stringify({ pares: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Pre-agrupar por clave normalizada (nombre+apellido) para reducir el espacio
    const buckets = new Map<string, any[]>()
    for (const p of personas) {
      const k = norm(`${p.nombres} ${p.apellidos}`)
      if (!k) continue
      const arr = buckets.get(k) ?? []
      arr.push(p); buckets.set(k, arr)
    }
    const candidatos: any[] = []
    for (const [, arr] of buckets) {
      if (arr.length < 2) continue
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j]
        const yA = a.nac_fecha ? new Date(a.nac_fecha).getUTCFullYear() : a.nac_rango_ini
        const yB = b.nac_fecha ? new Date(b.nac_fecha).getUTCFullYear() : b.nac_rango_ini
        const yearOk = !yA || !yB || Math.abs(yA - yB) <= 3
        const sexOk = !a.sexo || !b.sexo || a.sexo === b.sexo
        const score = (yearOk ? 50 : 10) + (sexOk ? 30 : 0) + 20
        candidatos.push({ a, b, score, motivo: `Mismo nombre normalizado${yearOk && yA && yB ? ` · año cercano (${yA} vs ${yB})` : ''}` })
      }
    }

    // Si hay <= 25 candidatos, dejamos a la IA validar/scorear
    let resultado = candidatos
    if (candidatos.length && candidatos.length <= 25) {
      try {
        const aiRes = await _aiFetch(req, {
            model: 'openai/gpt-4o-mini',
            messages: [
              { role: 'system', content: 'Eres genealogista. Decide si dos fichas son la MISMA persona. Responde JSON.' },
              { role: 'user', content: `Analiza estos pares (a y b son fichas distintas) y devuelve JSON { "pares": [{ "a_id": "...", "b_id": "...", "probabilidad": 0-100, "razon": "breve" }] }. Incluye SOLO pares con probabilidad ≥ 60.

PARES:
${JSON.stringify(candidatos.map(c => ({ a: c.a, b: c.b })), null, 2)}` },
            ],
            response_format: { type: 'json_object' },
        })
        if (aiRes.ok) {
          const ai = await aiRes.json()
          const j = JSON.parse(ai.choices[0].message.content)
          const byKey = new Map<string, any>()
          for (const c of candidatos) byKey.set(`${c.a.id}:${c.b.id}`, c)
          resultado = (j.pares ?? []).map((p: any) => {
            const c = byKey.get(`${p.a_id}:${p.b_id}`) ?? byKey.get(`${p.b_id}:${p.a_id}`)
            if (!c) return null
            return { ...c, score: p.probabilidad ?? c.score, motivo: p.razon ?? c.motivo, ia: true }
          }).filter(Boolean)
        }
      } catch (_) {}
    }

    // Persistir como coincidencias pendientes
    const rows = resultado.slice(0, 50).map((c: any) => ({
      user_id: user.id, tipo: 'duplicado',
      ref_a: c.a.id, ref_b: c.b.id, score: c.score,
      razones: [{ motivo: c.motivo, ia: !!c.ia }],
    }))
    if (rows.length) {
      await supa.from('coincidencias').delete().eq('user_id', user.id).eq('tipo', 'duplicado').eq('estado', 'pendiente')
      await supa.from('coincidencias').insert(rows)
    }

    return new Response(JSON.stringify({ pares: resultado.slice(0, 50) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
