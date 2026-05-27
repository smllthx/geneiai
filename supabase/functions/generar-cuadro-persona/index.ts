import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function svgToDataUrl(svg: string) {
  const bytes = new TextEncoder().encode(svg);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

function paletteFor(origen: string) {
  const text = origen.toLowerCase();
  if (text.includes('chile')) return { a: '#0ea5e9', b: '#ef4444', c: '#f8fafc' };
  if (text.includes('ital')) return { a: '#16a34a', b: '#dc2626', c: '#f8fafc' };
  if (text.includes('suiza') || text.includes('switzerland')) return { a: '#dc2626', b: '#f8fafc', c: '#171717' };
  if (text.includes('espa') || text.includes('spain')) return { a: '#f59e0b', b: '#dc2626', c: '#fef3c7' };
  return { a: '#22d3ee', b: '#a855f7', c: '#f8fafc' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { persona, estilo } = await req.json();
    if (!persona) throw new Error('Falta persona');

    const nombre = `${persona.nombres ?? ''} ${persona.apellidos ?? ''}`.trim() || 'Persona del árbol';
    const nac = persona.nac_fecha ?? persona.nac_fecha_aprox ?? '';
    const def = persona.defuncion_fecha ?? '';
    const ocup = persona.ocupacion ?? '';
    const nacionalidad = persona.nacionalidad ?? '';
    const lugar = persona.nac_lugar ?? persona.lugar_nacimiento ?? '';
    const foto = persona.foto_url ?? '';
    const origen = [lugar, nacionalidad].filter(Boolean).join(' · ');
    const fechas = [nac, def].filter(Boolean).join(' - ');
    const pal = paletteFor(origen);
    const style = estilo || 'cuadro genealógico moderno';

    const initials = nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p: string) => p[0]?.toUpperCase())
      .join('');

    const portrait = foto
      ? `<image href="${escapeXml(foto)}" x="260" y="145" width="280" height="280" preserveAspectRatio="xMidYMid slice" clip-path="url(#portraitClip)" />`
      : `<circle cx="400" cy="285" r="138" fill="url(#avatarGrad)" />
         <text x="400" y="315" text-anchor="middle" font-size="92" font-family="Georgia, serif" font-weight="700" fill="#fff">${escapeXml(initials || '?')}</text>`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100" viewBox="0 0 800 1100">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#06070a"/>
          <stop offset="0.55" stop-color="#17141d"/>
          <stop offset="1" stop-color="#070b12"/>
        </linearGradient>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${pal.a}"/>
          <stop offset="1" stop-color="${pal.b}"/>
        </linearGradient>
        <radialGradient id="avatarGrad" cx="50%" cy="38%" r="65%">
          <stop offset="0" stop-color="${pal.a}"/>
          <stop offset="1" stop-color="${pal.b}"/>
        </radialGradient>
        <clipPath id="portraitClip"><circle cx="400" cy="285" r="140"/></clipPath>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity="0.45"/>
        </filter>
      </defs>
      <rect width="800" height="1100" fill="url(#bg)"/>
      <rect x="45" y="45" width="710" height="1010" rx="34" fill="none" stroke="url(#accent)" stroke-width="5"/>
      <rect x="74" y="74" width="652" height="952" rx="26" fill="rgba(255,255,255,0.035)" stroke="rgba(255,255,255,0.14)"/>
      <g filter="url(#shadow)">
        <circle cx="400" cy="285" r="154" fill="#050505" stroke="url(#accent)" stroke-width="8"/>
        ${portrait}
      </g>
      <rect x="170" y="492" width="460" height="6" rx="3" fill="url(#accent)"/>
      <text x="400" y="585" text-anchor="middle" font-size="48" font-family="Inter, Arial, sans-serif" font-weight="800" fill="#fff">${escapeXml(nombre)}</text>
      <text x="400" y="638" text-anchor="middle" font-size="30" font-family="Inter, Arial, sans-serif" fill="#cbd5e1">${escapeXml(fechas || 'Fechas por completar')}</text>
      <text x="400" y="712" text-anchor="middle" font-size="26" font-family="Inter, Arial, sans-serif" fill="#f8fafc">${escapeXml(ocup || 'Historia familiar')}</text>
      <text x="400" y="758" text-anchor="middle" font-size="25" font-family="Inter, Arial, sans-serif" fill="#cbd5e1">${escapeXml(origen || 'Origen por investigar')}</text>
      <g transform="translate(128 830)">
        <rect width="544" height="128" rx="24" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)"/>
        <text x="272" y="50" text-anchor="middle" font-size="22" font-family="Inter, Arial, sans-serif" fill="#94a3b8">Cuadro genealógico</text>
        <text x="272" y="90" text-anchor="middle" font-size="28" font-family="Inter, Arial, sans-serif" font-weight="700" fill="${pal.c}">${escapeXml(style)}</text>
      </g>
      <text x="400" y="1002" text-anchor="middle" font-size="20" font-family="Inter, Arial, sans-serif" fill="#64748b">GENAIA · Archivo familiar</text>
    </svg>`;

    return new Response(JSON.stringify({ imageUrl: svgToDataUrl(svg), prompt: style, source: 'geneaia-local-cuadro' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
