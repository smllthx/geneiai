// Endpoint público (sin auth) para compartir una ficha de persona.
// Devuelve datos básicos sanitizados + mini biografía generada por IA.
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


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id') || (await req.json().catch(() => ({}))).id
    if (!id) return new Response(JSON.stringify({ error: 'missing id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: p } = await supa.from('personas').select('id,user_id,nombres,apellidos,sexo,nac_fecha,nac_rango_ini,nac_rango_fin,nac_lugar_id,defuncion_fecha,defuncion_lugar_id,ocupacion,nacionalidad,foto_url,viva,notas').eq('id', id).maybeSingle()
    if (!p) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // No filtrar datos sensibles para vivas — el usuario decidió compartir.
    // Pero ocultamos campos internos (notas largas, ids).
    const lugarIds = [p.nac_lugar_id, p.defuncion_lugar_id].filter(Boolean)
    let lugares: Record<string, any> = {}
    if (lugarIds.length) {
      const { data: ls } = await supa.from('lugares').select('id,ciudad,provincia,region,pais').in('id', lugarIds as any)
      for (const l of ls ?? []) lugares[l.id] = l
    }

    const lugarStr = (id?: string | null) => {
      if (!id) return null
      const l = lugares[id]
      if (!l) return null
      return [l.ciudad, l.provincia ?? l.region, l.pais].filter(Boolean).join(', ')
    }

    // Padres y cónyuges (solo nombres)
    const { data: rels } = await supa.from('relaciones').select('persona_id,pariente_id,tipo').or(`persona_id.eq.${id},pariente_id.eq.${id}`).eq('user_id', p.user_id)
    const padresIds: string[] = (rels ?? []).filter((r: any) => r.persona_id === id && (r.tipo === 'padre' || r.tipo === 'madre')).map((r: any) => r.pariente_id)
    const conyugesIds: string[] = (rels ?? []).filter((r: any) => r.tipo === 'conyuge' && (r.persona_id === id || r.pariente_id === id)).map((r: any) => r.persona_id === id ? r.pariente_id : r.persona_id)
    const hijosIds: string[] = (rels ?? []).filter((r: any) => r.tipo === 'hijo' && r.persona_id === id).map((r: any) => r.pariente_id)
    const allRelIds = Array.from(new Set([...padresIds, ...conyugesIds, ...hijosIds]))
    let relNames: Record<string, string> = {}
    if (allRelIds.length) {
      const { data: rs } = await supa.from('personas').select('id,nombres,apellidos').in('id', allRelIds)
      for (const r of rs ?? []) relNames[r.id] = `${r.nombres} ${r.apellidos}`.trim()
    }

    const year = (d?: string | null, r?: number | null) => d ? new Date(d).getUTCFullYear() : (r ?? null)

    const ficha = {
      id: p.id,
      nombres: p.nombres,
      apellidos: p.apellidos,
      sexo: p.sexo,
      foto_url: p.foto_url,
      nacimiento: { fecha: p.nac_fecha, anio: year(p.nac_fecha, p.nac_rango_ini), lugar: lugarStr(p.nac_lugar_id) },
      defuncion: { fecha: p.defuncion_fecha, anio: year(p.defuncion_fecha, null), lugar: lugarStr(p.defuncion_lugar_id) },
      ocupacion: p.ocupacion ?? null,
      nacionalidad: p.nacionalidad ?? null,
      padres: padresIds.map((i) => relNames[i]).filter(Boolean),
      conyuges: conyugesIds.map((i) => relNames[i]).filter(Boolean),
      hijos: hijosIds.map((i) => relNames[i]).filter(Boolean),
    }

    // Mini biografía con IA (mejor esfuerzo)
    let bio = ''
    try {
        const r = await _aiFetch(req, {
            model: 'openai/gpt-4o-mini',
            messages: [
              { role: 'system', content: 'Eres genealogista. Escribe una mini biografía cálida en español (3-4 frases) basada ESTRICTAMENTE en los datos provistos, sin inventar.' },
              { role: 'user', content: JSON.stringify(ficha) },
            ],
        })
        if (r.ok) {
          const j = await r.json()
          bio = j.choices?.[0]?.message?.content ?? ''
        }
    } catch (_) {}

    return new Response(JSON.stringify({ ficha, bio }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
