// Lectura experta de documentos genealógicos con IA multimodal.
// Acepta cualquier tipo (PDF, imagen, DOCX, TXT, etc.) en base64 + mime.
// Extrae personas, eventos, relaciones y lugares y los inserta directamente
// en la base de datos del usuario (certeza='probable') más una sugerencia-resumen.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM = `Eres un genealogista experto en documentos históricos (actas parroquiales, civiles, censos, padrones, cartas, libros, fotos con texto, etc.).
Tu trabajo: leer el documento adjunto, extraer TODA la información genealógica verificable y devolverla estructurada.

Reglas estrictas:
- No inventes datos. Si algo no aparece explícito, omítelo o márcalo como "aprox".
- Normaliza nombres y apellidos respetando la grafía original (en "notas" puedes anotar variantes).
- Fechas en formato YYYY-MM-DD si son completas; si solo hay año, usa fecha_aprox "YYYY".
- Para relaciones, usa los nombres tal como aparecen y describe el vínculo (padre, madre, cónyuge, hijo, padrino, testigo).
- Incluye un breve "resumen" del documento y "transcripcion" parcial de los fragmentos relevantes (máx 1500 chars).
- Si no hay nada genealógicamente útil, devuelve listas vacías y explícalo en "resumen".
- Devuelve SIEMPRE la herramienta extraer_genealogia.`;

const tool = {
  type: "function",
  function: {
    name: "extraer_genealogia",
    description: "Datos genealógicos extraídos del documento.",
    parameters: {
      type: "object",
      properties: {
        resumen: { type: "string" },
        transcripcion: { type: "string" },
        tipo_documento: { type: "string", description: "ej: acta_bautismo, acta_matrimonio, acta_defuncion, censo, carta, foto, libro, otro" },
        fecha_documento: { type: "string", description: "YYYY-MM-DD o aprox" },
        lugar_documento: { type: "string" },
        personas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ref: { type: "string", description: "id interno único en este extracto (p1, p2...)" },
              nombres: { type: "string" },
              apellidos: { type: "string" },
              sexo: { type: "string", enum: ["M", "F", ""] },
              rol: { type: "string", description: "ej: principal, padre, madre, conyuge, padrino, testigo, hijo" },
              nac_fecha: { type: "string" },
              nac_fecha_aprox: { type: "string" },
              nac_lugar: { type: "string" },
              defuncion_fecha: { type: "string" },
              defuncion_lugar: { type: "string" },
              bautismo_fecha: { type: "string" },
              matrimonio_fecha: { type: "string" },
              ocupacion: { type: "string" },
              nacionalidad: { type: "string" },
              religion: { type: "string" },
              notas: { type: "string" },
            },
            required: ["ref", "nombres", "apellidos"],
          },
        },
        eventos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              persona_ref: { type: "string" },
              tipo: { type: "string", description: "nacimiento|bautismo|matrimonio|defuncion|entierro|migracion|otro" },
              fecha: { type: "string" },
              fecha_aprox: { type: "string" },
              lugar: { type: "string" },
              descripcion: { type: "string" },
            },
            required: ["persona_ref", "tipo"],
          },
        },
        relaciones: {
          type: "array",
          items: {
            type: "object",
            properties: {
              a_ref: { type: "string" },
              b_ref: { type: "string" },
              tipo: { type: "string", description: "padre|madre|conyuge|hijo|padrino|testigo" },
            },
            required: ["a_ref", "b_ref", "tipo"],
          },
        },
        lugares: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nombre: { type: "string" },
              ciudad: { type: "string" },
              provincia: { type: "string" },
              region: { type: "string" },
              pais: { type: "string" },
              parroquia: { type: "string" },
            },
            required: ["nombre"],
          },
        },
      },
      required: ["resumen", "personas"],
    },
  },
};

const norm = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function toDate(s?: string): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? s : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY no configurada");

    const auth = req.headers.get("Authorization") ?? "";
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser();
    const user = u.user;
    if (!user) return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { file_base64, mime_type, filename, text_content, documento_id } = body as {
      file_base64?: string; mime_type?: string; filename?: string; text_content?: string; documento_id?: string;
    };

    // Build user message
    const userContent: any[] = [];
    userContent.push({
      type: "text",
      text: `Analiza este documento genealógico (nombre: ${filename ?? "sin nombre"}). Extrae todo lo verificable.`,
    });
    if (text_content && text_content.trim()) {
      userContent.push({ type: "text", text: `\n\nCONTENIDO DE TEXTO:\n${text_content.slice(0, 60000)}` });
    }
    if (file_base64 && mime_type) {
      if (mime_type.startsWith("image/") || mime_type === "application/pdf") {
        userContent.push({
          type: "image_url",
          image_url: { url: `data:${mime_type};base64,${file_base64}` },
        });
      } else {
        // Fallback: incluir nombre del archivo
        userContent.push({ type: "text", text: `\n(archivo binario ${mime_type} no soportado para visión)` });
      }
    }

    const aiRes = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "extraer_genealogia" } },
      }),
    });
    if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Límite alcanzado, intentá en un minuto." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Sin créditos de Lovable AI." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("ai err", aiRes.status, t);
      throw new Error(`AI gateway ${aiRes.status}`);
    }
    const aiJson = await aiRes.json();
    const tc = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) throw new Error("Sin respuesta estructurada");
    const ext = JSON.parse(tc.function.arguments);

    // De-dupe personas contra las existentes del usuario por nombre+apellido normalizado
    const { data: existentes } = await sb.from("personas").select("id, nombres, apellidos, nac_fecha")
      .eq("user_id", user.id).limit(2000);
    const idx = new Map<string, string>();
    for (const p of existentes ?? []) {
      idx.set(`${norm(p.nombres)}|${norm(p.apellidos)}`, p.id);
    }

    const refToId = new Map<string, string>();
    let personasCreadas = 0, personasReusadas = 0;

    for (const p of ext.personas ?? []) {
      const key = `${norm(p.nombres)}|${norm(p.apellidos)}`;
      let id = idx.get(key);
      if (!id) {
        const row: any = {
          user_id: user.id,
          nombres: p.nombres,
          apellidos: p.apellidos,
          sexo: p.sexo || null,
          nac_fecha: toDate(p.nac_fecha),
          nac_fecha_aprox: !toDate(p.nac_fecha) ? (p.nac_fecha_aprox || p.nac_fecha || null) : null,
          defuncion_fecha: toDate(p.defuncion_fecha),
          bautismo_fecha: toDate(p.bautismo_fecha),
          matrimonio_fecha: toDate(p.matrimonio_fecha),
          ocupacion: p.ocupacion || null,
          nacionalidad: p.nacionalidad || null,
          religion: p.religion || null,
          notas: [p.notas, p.rol ? `Rol en doc: ${p.rol}` : null, filename ? `Extraído de ${filename}` : null].filter(Boolean).join("\n"),
          certeza: "probable",
          viva: "desconocido",
          ids_externos: { extraido_de: filename ?? null, documento_id: documento_id ?? null },
        };
        const { data: ins, error } = await sb.from("personas").insert(row).select("id").single();
        if (error) { console.error("insert persona", error); continue; }
        id = ins.id;
        personasCreadas++;
        idx.set(key, id);
      } else {
        personasReusadas++;
      }
      refToId.set(p.ref, id);
    }

    // Eventos
    let eventosCreados = 0;
    for (const e of ext.eventos ?? []) {
      const pid = refToId.get(e.persona_ref);
      if (!pid) continue;
      const fecha = toDate(e.fecha);
      const { error } = await sb.from("eventos").insert({
        user_id: user.id,
        persona_id: pid,
        tipo: e.tipo,
        fecha,
        fecha_aprox: !fecha ? (e.fecha_aprox || e.fecha || null) : null,
        lugar_original: e.lugar || null,
        descripcion: e.descripcion || null,
        certeza: "probable",
      });
      if (!error) eventosCreados++;
    }

    // Relaciones
    let relacionesCreadas = 0;
    const tipoMap: Record<string, string> = {
      padre: "padre", madre: "madre", conyuge: "conyuge", hijo: "hijo",
      padrino: "padrino", madrina: "madrina", testigo: "testigo",
    };
    for (const r of ext.relaciones ?? []) {
      const a = refToId.get(r.a_ref), b = refToId.get(r.b_ref);
      if (!a || !b) continue;
      const tipo = tipoMap[r.tipo] ?? r.tipo;
      const { error } = await sb.from("relaciones").insert({
        user_id: user.id, persona_id: a, pariente_id: b, tipo,
        naturaleza: "biologica", certeza: "probable",
      });
      if (!error) relacionesCreadas++;
    }

    // Resumen como sugerencia (revisable / rollback manual)
    await sb.from("sugerencias").insert({
      user_id: user.id,
      tipo: "extraccion_documento",
      titulo: `Documento leído: ${filename ?? ext.tipo_documento ?? "sin nombre"}`,
      descripcion: ext.resumen,
      payload: {
        tipo_documento: ext.tipo_documento,
        fecha_documento: ext.fecha_documento,
        lugar_documento: ext.lugar_documento,
        transcripcion: ext.transcripcion,
        personasCreadas, personasReusadas, eventosCreados, relacionesCreadas,
        documento_id: documento_id ?? null,
      },
      confianza: 70,
      origen: "leer-documento-ia",
      estado: "pendiente",
    });

    // Actividad
    await sb.from("actividad").insert({
      user_id: user.id,
      tipo: "ia_lectura_documento",
      descripcion: `IA extrajo ${personasCreadas} personas, ${eventosCreados} eventos, ${relacionesCreadas} relaciones de "${filename ?? "documento"}"`,
      metadata: { filename, personasCreadas, eventosCreados, relacionesCreadas },
    });

    return new Response(JSON.stringify({
      ok: true,
      resumen: ext.resumen,
      tipo_documento: ext.tipo_documento,
      personasCreadas, personasReusadas, eventosCreados, relacionesCreadas,
      transcripcion: ext.transcripcion,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("leer-documento-ia", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
