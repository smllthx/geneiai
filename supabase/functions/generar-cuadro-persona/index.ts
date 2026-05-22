import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { persona, estilo } = await req.json();
    if (!persona) throw new Error('Falta persona');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY no configurado');

    const nombre = `${persona.nombres ?? ''} ${persona.apellidos ?? ''}`.trim();
    const nac = persona.nac_fecha ?? persona.nac_fecha_aprox ?? '';
    const def = persona.defuncion_fecha ?? '';
    const ocup = persona.ocupacion ?? '';
    const nacionalidad = persona.nacionalidad ?? '';
    const lugar = persona.lugar_nacimiento ?? '';

    const style = estilo || 'retrato cuadro genealógico vintage estilo familysearch';

    const prompt = `Generá un cuadro genealógico decorativo de alta calidad de "${nombre}".
Estilo: ${style}. Composición: marco ornamentado clásico, fondo sepia/pergamino antiguo,
retrato central (si no hay foto, ilustración pictórica de época según nacionalidad ${nacionalidad}),
tipografía serif elegante con el nombre completo grande arriba,
debajo: fechas (${nac} - ${def}), ocupación: ${ocup}, origen: ${lugar} ${nacionalidad}.
Apariencia de cuadro listo para imprimir y colgar. Sin marcas de agua. Idioma español.`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Gateway ${resp.status}: ${t}`);
    }
    const data = await resp.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl) throw new Error('No se generó imagen');

    return new Response(JSON.stringify({ imageUrl, prompt }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
