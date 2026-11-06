import { findIdentityCandidates } from "../_shared/identityCandidates.ts";
import { collectRows } from "../_shared/collectRows.ts";
import { rejectUnauthenticated } from "../_shared/auth.ts";
import { corsHeaders } from 'npm:@supabase/supabase-js@2.115.0/cors'
import { createClient } from 'npm:@supabase/supabase-js@2.115.0'


Deno.serve(async (req) => {
  const geneaiAccessRejection = await rejectUnauthenticated(req);
  if (geneaiAccessRejection) return geneaiAccessRejection;
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', Allow: 'POST, OPTIONS' },
    })
  }
  try {
    const auth = req.headers.get('Authorization') ?? ''
    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    })
    const { data: { user }, error: authError } = await supa.auth.getUser()
    if (authError) throw authError
    if (!user) return new Response(JSON.stringify({ error: 'no auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: profile, error: profileError } = await supa
      .from('profiles')
      .select('active_arbol_id')
      .eq('id', user.id)
      .maybeSingle()
    if (profileError) throw profileError
    const treeId = profile?.active_arbol_id as string | null
    if (!treeId) {
      return new Response(JSON.stringify({ error: 'Selecciona un archivo familiar antes de buscar duplicados.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: ownedTree, error: treeError } = await supa
      .from('arboles')
      .select('id')
      .eq('id', treeId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (treeError) throw treeError
    if (!ownedTree) {
      return new Response(JSON.stringify({ error: 'El archivo familiar activo no pertenece a esta cuenta.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const [personas, equivalents] = await Promise.all([
      collectRows((from,to) => supa.from('personas').select('id,nombres,apellidos,variantes_nombre,nac_fecha,nac_fecha_aprox,nac_rango_ini,nac_rango_fin,defuncion_fecha,nac_lugar_id,sexo').eq('user_id',user.id).eq('arbol_id',treeId).is('fusionado_en',null).order('id').range(from,to)),
      collectRows((from,to) => supa.from('equivalencias_nombre').select('nombre_base,equivalente').eq('user_id',user.id).order('id').range(from,to)),
    ]);
    const candidatos = findIdentityCandidates(personas, equivalents);

    // Esta preselección es deliberadamente determinista: no decide identidad ni asigna
    // probabilidades. Cada par queda como candidato para comparación documental humana.
    const resultado = candidatos.slice(0, 50)

    // `coincidencias` no tiene arbol_id en el esquema actual. Guardamos en la
    // bandeja de sugerencias, que sí permite aislar cada revisión por árbol.
    const { error: clearError } = await supa
      .from('sugerencias')
      .delete()
      .eq('user_id', user.id)
      .eq('arbol_id', treeId)
      .eq('origen', 'detectar-duplicados')
      .eq('estado', 'pendiente')
    if (clearError) throw clearError

    const rows = resultado.map((c: any) => ({
      user_id: user.id,
      arbol_id: treeId,
      tipo: 'posible_duplicado',
      titulo: `Comparar posible duplicado: ${[c.a.nombres, c.a.apellidos].filter(Boolean).join(' ')} / ${[c.b.nombres, c.b.apellidos].filter(Boolean).join(' ')}`.slice(0, 200),
      descripcion: 'Dos fichas del archivo comparten nombres o variantes registradas. Revisa las fuentes originales antes de fusionar o corregir.',
      persona_id: c.a.id,
      confianza: 0,
      origen: 'detectar-duplicados',
      estado: 'pendiente',
      payload: {
        ref_a: c.a.id,
        ref_b: c.b.id,
        ficha_a: c.a,
        ficha_b: c.b,
        indicios: c.indicios,
        contradicciones: c.contradicciones,
        clasificacion_evidencia: 'candidato',
        verificacion: 'sin_verificar',
        fusion_automatica: false,
      },
    }))
    if (rows.length) {
      const { error: insertError } = await supa.from('sugerencias').insert(rows)
      if (insertError) throw insertError
    }

    return new Response(JSON.stringify({
      propuestas_creadas: rows.length,
      candidatos_totales: candidatos.length,
      truncado: candidatos.length > resultado.length,
      estado: 'sin_verificar',
      review_path: '/sugerencias',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
