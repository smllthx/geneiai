// Procesa documentos del usuario: descarga, detecta tipo y extrae personas con IA,
// deduplica contra el árbol e inserta filas en `sugerencias`.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

function norm(s: string | null | undefined) {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function yearFrom(d: string | null | undefined): number | null {
  if (!d) return null
  const m = String(d).match(/(\d{4})/)
  return m ? parseInt(m[1]) : null
}

function dedupeKey(nombres: string, apellidos: string, year: number | null) {
  return `${norm(nombres)}|${norm(apellidos)}|${year ?? ''}`
}

// ---------- GEDCOM (mini parser, suficiente para extraer INDI) ----------
type GedPerson = { nombres: string; apellidos: string; sexo?: string | null; nac_fecha?: string | null; nac_lugar?: string | null; defuncion_fecha?: string | null; defuncion_lugar?: string | null; ocupacion?: string | null; notas?: string | null }

function gedMonth(m: string): string | null {
  const M: Record<string, string> = { JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12' }
  return M[m.toUpperCase()] ?? null
}
function gedDate(s?: string): string | null {
  if (!s) return null
  s = s.replace(/^(ABT|AFT|BEF|EST|CAL|FROM|TO|BET|AND)\s+/i, '').trim()
  let m = s.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/i)
  if (m) { const mm = gedMonth(m[2]); if (mm) return `${m[3]}-${mm}-${m[1].padStart(2,'0')}` }
  m = s.match(/^([A-Z]{3})\s+(\d{4})$/i)
  if (m) { const mm = gedMonth(m[1]); if (mm) return `${m[2]}-${mm}-01` }
  m = s.match(/^(\d{4})$/); if (m) return `${m[1]}-01-01`
  return null
}
function splitName(full: string) {
  const m = full.match(/^(.*?)\/([^/]*)\/(.*)$/)
  if (m) return { nombres: (m[1] + ' ' + m[3]).trim() || '(sin nombre)', apellidos: m[2].trim() || '(sin apellido)' }
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return { nombres: parts[0] || '(sin nombre)', apellidos: '(sin apellido)' }
  return { nombres: parts.slice(0, -1).join(' '), apellidos: parts[parts.length - 1] }
}

function parseGedcom(text: string): GedPerson[] {
  const lines = text.split(/\r?\n/)
  const records: { level: number; tag: string; value: string; xref?: string }[] = []
  for (const raw of lines) {
    const m = raw.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?([A-Z0-9_]+)(?:\s+(.*))?$/)
    if (!m) continue
    records.push({ level: parseInt(m[1]), xref: m[2], tag: m[3], value: (m[4] ?? '').trim() })
  }
  const out: GedPerson[] = []
  let i = 0
  while (i < records.length) {
    const r = records[i]
    if (r.level === 0 && r.tag === 'INDI') {
      let j = i + 1
      let fullName = ''
      let sex: string | null = null
      let birthDate: string | null = null, birthPlace: string | null = null
      let deathDate: string | null = null, deathPlace: string | null = null
      let occ: string | null = null
      const notes: string[] = []
      while (j < records.length && records[j].level > 0) {
        const x = records[j]
        if (x.level === 1 && x.tag === 'NAME') fullName = x.value
        else if (x.level === 1 && x.tag === 'SEX') sex = x.value === 'F' ? 'femenino' : x.value === 'M' ? 'masculino' : null
        else if (x.level === 1 && (x.tag === 'BIRT' || x.tag === 'DEAT' || x.tag === 'BAPM' || x.tag === 'CHR')) {
          const evt = x.tag
          let k = j + 1
          while (k < records.length && records[k].level > 1) {
            if (records[k].level === 2 && records[k].tag === 'DATE') {
              const d = gedDate(records[k].value)
              if (evt === 'BIRT') birthDate = d
              else if (evt === 'DEAT') deathDate = d
            } else if (records[k].level === 2 && records[k].tag === 'PLAC') {
              if (evt === 'BIRT') birthPlace = records[k].value
              else if (evt === 'DEAT') deathPlace = records[k].value
            }
            k++
          }
        } else if (x.level === 1 && x.tag === 'OCCU') occ = x.value
        else if (x.level === 1 && x.tag === 'NOTE') notes.push(x.value)
        j++
      }
      if (fullName) {
        const { nombres, apellidos } = splitName(fullName)
        out.push({ nombres, apellidos, sexo: sex, nac_fecha: birthDate, nac_lugar: birthPlace, defuncion_fecha: deathDate, defuncion_lugar: deathPlace, ocupacion: occ, notas: notes.join('\n') || null })
      }
      i = j
    } else i++
  }
  return out
}

// ---------- IA: extracción de personas de texto libre ----------
async function extraerPersonasIA(texto: string, contextoDoc: string): Promise<GedPerson[]> {
  const aiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!aiKey) return []
  const cap = texto.length > 40000 ? texto.slice(0, 40000) : texto
  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${aiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: 'Eres genealogista paleógrafo experto en documentos europeos y americanos del siglo XVIII al XXI (1700-2025). Dominas español (incl. colonial), italiano (toscano, latín eclesiástico), alemán (Kurrent, Sütterlin, Fraktur) e inglés moderno temprano. Extrae TODAS las personas mencionadas con su información biográfica disponible. Registra el nombre tal como aparece en el documento y, si aplica, la equivalencia vernácula en "notas" (p. ej. "Joannes → Juan / Giovanni / Johann"). No inventes datos.' },
        { role: 'user', content: `Documento: ${contextoDoc}\n\nTexto:\n${cap}` },
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'extraer_personas',
          description: 'Lista de personas detectadas en el documento',
          parameters: {
            type: 'object',
            properties: {
              personas: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    nombres: { type: 'string' },
                    apellidos: { type: 'string' },
                    sexo: { type: 'string', enum: ['masculino', 'femenino', ''] },
                    nac_fecha: { type: 'string', description: 'YYYY-MM-DD o YYYY si solo año, vacío si no aparece' },
                    nac_lugar: { type: 'string' },
                    defuncion_fecha: { type: 'string' },
                    defuncion_lugar: { type: 'string' },
                    ocupacion: { type: 'string' },
                    notas: { type: 'string' },
                  },
                  required: ['nombres', 'apellidos'],
                },
              },
            },
            required: ['personas'],
          },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'extraer_personas' } },
    }),
  })
  if (!res.ok) return []
  const j = await res.json()
  const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
  if (!args) return []
  try {
    const parsed = JSON.parse(args)
    return (parsed.personas ?? []).map((p: any) => ({
      nombres: String(p.nombres ?? '').trim(),
      apellidos: String(p.apellidos ?? '').trim(),
      sexo: p.sexo || null,
      nac_fecha: p.nac_fecha?.match(/^\d{4}$/) ? `${p.nac_fecha}-01-01` : (p.nac_fecha || null),
      nac_lugar: p.nac_lugar || null,
      defuncion_fecha: p.defuncion_fecha?.match(/^\d{4}$/) ? `${p.defuncion_fecha}-01-01` : (p.defuncion_fecha || null),
      defuncion_lugar: p.defuncion_lugar || null,
      ocupacion: p.ocupacion || null,
      notas: p.notas || null,
    })).filter((p: GedPerson) => p.nombres && p.apellidos)
  } catch { return [] }
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

    const body = await req.json().catch(() => ({}))
    const documentoIds: string[] | undefined = body.documento_ids
    const max = Math.min(body.max ?? 10, 25)

    // Documentos a procesar
    const docQuery = supa.from('documentos').select('id,titulo,tipo,archivo_path,transcripcion,ocr_texto,resumen').eq('user_id', user.id)
    const { data: docs } = documentoIds?.length ? await docQuery.in('id', documentoIds) : await docQuery.order('created_at', { ascending: false }).limit(max)
    if (!docs?.length) return new Response(JSON.stringify({ procesados: 0, creadas: 0, duplicadas: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Personas existentes para deduplicar
    const { data: existentes } = await supa.from('personas').select('nombres,apellidos,nac_fecha,nac_rango_ini').eq('user_id', user.id)
    const dedupe = new Set<string>()
    for (const p of existentes ?? []) {
      dedupe.add(dedupeKey(p.nombres, p.apellidos, yearFrom(p.nac_fecha) ?? p.nac_rango_ini ?? null))
      dedupe.add(dedupeKey(p.nombres, p.apellidos, null))
    }

    // Sugerencias persona ya pendientes (evitar duplicar inserciones)
    const { data: pendientes } = await supa.from('sugerencias').select('payload').eq('user_id', user.id).eq('tipo', 'persona').eq('estado', 'pendiente')
    for (const s of pendientes ?? []) {
      const pp = (s.payload ?? {}) as any
      dedupe.add(dedupeKey(pp.nombres ?? '', pp.apellidos ?? '', yearFrom(pp.nac_fecha)))
    }

    let creadas = 0, duplicadas = 0, procesados = 0
    const filas: any[] = []

    for (const d of docs) {
      procesados++
      const detalle: GedPerson[] = []
      const titulo = (d.titulo ?? '').toLowerCase()
      const isGedcom = titulo.endsWith('.ged') || d.tipo === 'familysearch'

      // 1) Descargar contenido si es texto / GEDCOM
      let texto = (d.transcripcion ?? '') + '\n' + (d.ocr_texto ?? '') + '\n' + (d.resumen ?? '')
      if (d.archivo_path) {
        try {
          const { data: file } = await supa.storage.from('documentos').download(d.archivo_path)
          if (file) {
            const name = d.archivo_path.toLowerCase()
            const looksText = isGedcom || name.endsWith('.ged') || name.endsWith('.txt') || name.endsWith('.csv') || name.endsWith('.json') || name.endsWith('.md') || name.endsWith('.html')
            if (looksText) {
              const t = await file.text()
              if (name.endsWith('.ged') || /^\s*0\s+head/i.test(t.slice(0, 200))) {
                // GEDCOM
                detalle.push(...parseGedcom(t))
              } else {
                texto += '\n' + t
              }
            }
          }
        } catch (_) { /* ignore */ }
      }

      // 2) Si no es GEDCOM y hay texto, pedir extracción a IA
      if (detalle.length === 0 && texto.trim().length > 40) {
        const ai = await extraerPersonasIA(texto, `${d.titulo} (${d.tipo})`)
        detalle.push(...ai)
      }

      // 3) Crear sugerencias deduplicando
      for (const p of detalle) {
        const y = yearFrom(p.nac_fecha)
        const k1 = dedupeKey(p.nombres, p.apellidos, y)
        const k2 = dedupeKey(p.nombres, p.apellidos, null)
        if (dedupe.has(k1) || (y === null && dedupe.has(k2))) { duplicadas++; continue }
        dedupe.add(k1)
        filas.push({
          user_id: user.id,
          tipo: 'persona',
          titulo: `${p.nombres} ${p.apellidos}${y ? ` (n. ${y})` : ''}`,
          descripcion: [p.ocupacion, p.nac_lugar].filter(Boolean).join(' · ') || null,
          confianza: isGedcom ? 90 : 65,
          origen: `documento:${d.id}`,
          payload: { ...p, documento_id: d.id, documento_titulo: d.titulo },
        })
        creadas++
      }
    }

    // 4) Insertar por chunks (GEDCOM de 1600 personas → muchas filas)
    const chunkSize = 400
    for (let i = 0; i < filas.length; i += chunkSize) {
      const chunk = filas.slice(i, i + chunkSize)
      const { error } = await supa.from('sugerencias').insert(chunk)
      if (error) console.error('insert error', error)
    }

    return new Response(JSON.stringify({ procesados, creadas, duplicadas }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
