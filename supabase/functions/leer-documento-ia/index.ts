// Lectura experta de documentos genealógicos con IA multimodal.
// Soporta PDFs grandes (cientos de páginas) partiéndolos en chunks de 15
// páginas y procesándolos en paralelo (3 concurrentes). Acepta también
// imágenes, texto, DOCX/TXT/CSV. Inserta personas/eventos/relaciones
// directamente y deduplica por nombre+apellido+año-nacimiento.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const CHUNK_PAGES = 15;
const MAX_CONCURRENT = 3;

const SYSTEM = `Eres un genealogista paleógrafo experto en documentos históricos europeos y americanos del siglo XVIII al XXI (1700-2025).
Dominás con fluidez nativa: español (incluido colonial y antiguo), italiano (toscano, dialectos regionales, latín eclesiástico), alemán (incl. Kurrent, Sütterlin y Fraktur) e inglés (incl. inglés moderno temprano).
Reconoces actas parroquiales, registros civiles, censos, padrones, libri di stato, Kirchenbücher, parish records, cartas, libros, esquelas y fotos con texto.

Reglas estrictas:
- No inventes datos. Si algo no aparece explícito, omítelo o márcalo como "aprox".
- Normaliza nombres y apellidos respetando la grafía original (en "notas" puedes anotar variantes en otros idiomas: p. ej. "Giovanni / Juan / Johann / John").
- Latinizaciones eclesiásticas (Joannes, Maria, Petrus) → registra ambas formas: la del documento y la vernácula.
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
        tipo_documento: { type: "string" },
        fecha_documento: { type: "string" },
        lugar_documento: { type: "string" },
        personas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ref: { type: "string" },
              nombres: { type: "string" },
              apellidos: { type: "string" },
              sexo: { type: "string", enum: ["M", "F", ""] },
              rol: { type: "string" },
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
              tipo: { type: "string" },
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
              tipo: { type: "string" },
            },
            required: ["a_ref", "b_ref", "tipo"],
          },
        },
      },
      required: ["resumen", "personas"],
    },
  },
};

const norm = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

function toDate(s?: string): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? s : null;
}
function yearOf(s?: string | null): string {
  if (!s) return "";
  const m = String(s).match(/(\d{4})/);
  return m ? m[1] : "";
}
function dedupeKey(nombres: string, apellidos: string, year: string): string {
  return `${norm(nombres)}|${norm(apellidos)}|${year}`;
}

// Base64 helpers (chunked para evitar stack overflow con archivos grandes)
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const len = bin.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(bin);
}

async function splitPdfBase64(b64: string, chunkPages = CHUNK_PAGES): Promise<string[]> {
  const bytes = base64ToBytes(b64);
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  if (total <= chunkPages) return [b64];
  const chunks: string[] = [];
  for (let start = 0; start < total; start += chunkPages) {
    const end = Math.min(start + chunkPages, total);
    const out = await PDFDocument.create();
    const idxs = Array.from({ length: end - start }, (_, i) => start + i);
    const pages = await out.copyPages(src, idxs);
    for (const p of pages) out.addPage(p);
    const outBytes = await out.save();
    chunks.push(bytesToBase64(outBytes));
  }
  return chunks;
}

async function callAI(userContent: any[], LOVABLE_API_KEY: string): Promise<any | null> {
  // Si el usuario configuró OPENAI_API_KEY, usamos su cuenta de OpenAI.
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const useOpenAI = !!openaiKey;
  const url = useOpenAI ? "https://api.openai.com/v1/chat/completions" : GATEWAY_URL;
  const apiKey = useOpenAI ? openaiKey! : LOVABLE_API_KEY;
  // gpt-4o soporta visión + tool calling; gemini-2.5-pro vía gateway.
  const model = useOpenAI ? "gpt-4o" : "google/gemini-2.5-pro";

  const aiRes = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userContent },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "extraer_genealogia" } },
    }),
  });
  if (aiRes.status === 429) throw new Error("RATE_LIMIT");
  if (aiRes.status === 402) throw new Error("NO_CREDITS");
  if (!aiRes.ok) {
    const t = await aiRes.text();
    console.error("ai err", aiRes.status, t.slice(0, 300));
    return null;
  }
  const aiJson = await aiRes.json();
  const tc = aiJson.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) return null;
  try { return JSON.parse(tc.function.arguments); } catch { return null; }
}


async function pMap<T, R>(items: T[], fn: (x: T, i: number) => Promise<R>, concurrency = MAX_CONCURRENT): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

function mergeExtractions(parts: any[], filename?: string): any {
  const merged: any = {
    resumen: "",
    transcripcion: "",
    tipo_documento: "",
    fecha_documento: "",
    lugar_documento: "",
    personas: [] as any[],
    eventos: [] as any[],
    relaciones: [] as any[],
  };
  // Map ref local -> ref global (prefijado por chunk)
  let refSeq = 0;
  parts.forEach((ext, ci) => {
    if (!ext) return;
    if (ext.tipo_documento && !merged.tipo_documento) merged.tipo_documento = ext.tipo_documento;
    if (ext.fecha_documento && !merged.fecha_documento) merged.fecha_documento = ext.fecha_documento;
    if (ext.lugar_documento && !merged.lugar_documento) merged.lugar_documento = ext.lugar_documento;
    if (ext.resumen) merged.resumen += (merged.resumen ? "\n" : "") + `[chunk ${ci + 1}] ${ext.resumen}`;
    if (ext.transcripcion) merged.transcripcion += (merged.transcripcion ? "\n---\n" : "") + ext.transcripcion;

    const refMap = new Map<string, string>();
    for (const p of ext.personas ?? []) {
      const g = `g${refSeq++}`;
      refMap.set(p.ref, g);
      merged.personas.push({ ...p, ref: g });
    }
    for (const e of ext.eventos ?? []) {
      const r = refMap.get(e.persona_ref);
      if (r) merged.eventos.push({ ...e, persona_ref: r });
    }
    for (const r of ext.relaciones ?? []) {
      const a = refMap.get(r.a_ref), b = refMap.get(r.b_ref);
      if (a && b) merged.relaciones.push({ ...r, a_ref: a, b_ref: b });
    }
  });
  // Dedupe interno entre chunks
  const seen = new Map<string, string>();
  const remap = new Map<string, string>();
  const uniqPersonas: any[] = [];
  for (const p of merged.personas) {
    const key = dedupeKey(p.nombres, p.apellidos, yearOf(p.nac_fecha || p.nac_fecha_aprox));
    const prev = seen.get(key);
    if (prev) { remap.set(p.ref, prev); continue; }
    seen.set(key, p.ref);
    uniqPersonas.push(p);
  }
  merged.personas = uniqPersonas;
  for (const e of merged.eventos) e.persona_ref = remap.get(e.persona_ref) ?? e.persona_ref;
  for (const r of merged.relaciones) {
    r.a_ref = remap.get(r.a_ref) ?? r.a_ref;
    r.b_ref = remap.get(r.b_ref) ?? r.b_ref;
  }
  if (filename) merged.resumen = `Archivo: ${filename}\n${merged.resumen}`;
  return merged;
}

async function processDocument(params: {
  sb: any; userId: string; LOVABLE_API_KEY: string;
  file_base64?: string; mime_type?: string; filename?: string; text_content?: string; documento_id?: string;
}) {
  const { sb, userId, LOVABLE_API_KEY, file_base64, mime_type, filename, text_content, documento_id } = params;

  const chunkPayloads: Array<{ b64?: string; mime?: string; text?: string; label: string }> = [];
  if (file_base64 && mime_type === "application/pdf") {
    try {
      const parts = await splitPdfBase64(file_base64, CHUNK_PAGES);
      parts.forEach((b64, i) => chunkPayloads.push({
        b64, mime: "application/pdf",
        label: parts.length > 1 ? `${filename ?? "PDF"} (parte ${i + 1}/${parts.length})` : (filename ?? "PDF"),
      }));
      console.log(`PDF dividido en ${parts.length} chunks`);
    } catch (e) {
      console.error("split pdf", e);
      chunkPayloads.push({ b64: file_base64, mime: mime_type, label: filename ?? "PDF" });
    }
  } else if (file_base64 && mime_type?.startsWith("image/")) {
    chunkPayloads.push({ b64: file_base64, mime: mime_type, label: filename ?? "imagen" });
  } else if (text_content && text_content.trim()) {
    const MAX = 50000;
    if (text_content.length <= MAX) chunkPayloads.push({ text: text_content, label: filename ?? "texto" });
    else for (let i = 0, n = 1; i < text_content.length; i += MAX, n++) {
      chunkPayloads.push({ text: text_content.slice(i, i + MAX), label: `${filename ?? "texto"} (parte ${n})` });
    }
  } else if (file_base64 && mime_type) {
    chunkPayloads.push({ b64: file_base64, mime: mime_type, label: filename ?? "archivo" });
  } else {
    throw new Error("Sin contenido");
  }

  // Marcar inicio en actividad
  await sb.from("actividad").insert({
    user_id: userId, tipo: "ia_lectura_documento_inicio",
    descripcion: `📥 Procesando "${filename ?? "documento"}" en segundo plano (${chunkPayloads.length} ${chunkPayloads.length === 1 ? "parte" : "partes"})…`,
    metadata: { filename, chunks: chunkPayloads.length, estado: "en_curso" },
  });

  const results = await pMap(chunkPayloads, async (c) => {
    const userContent: any[] = [{ type: "text", text: `Analiza este documento genealógico (${c.label}). Extrae todo lo verificable.` }];
    if (c.text) userContent.push({ type: "text", text: `\n\nCONTENIDO:\n${c.text}` });
    if (c.b64 && c.mime && (c.mime.startsWith("image/") || c.mime === "application/pdf")) {
      userContent.push({ type: "image_url", image_url: { url: `data:${c.mime};base64,${c.b64}` } });
    }
    try { return await callAI(userContent, LOVABLE_API_KEY); }
    catch (e: any) {
      if (e?.message === "RATE_LIMIT" || e?.message === "NO_CREDITS") throw e;
      console.error("chunk fail", c.label, e);
      return null;
    }
  });

  const ok = results.filter(Boolean);
  if (!ok.length) throw new Error("La IA no devolvió datos estructurados de ningún chunk");
  const ext = mergeExtractions(ok, filename);

  const { data: existentes } = await sb.from("personas").select("id, nombres, apellidos, nac_fecha, nac_fecha_aprox, defuncion_fecha, bautismo_fecha, matrimonio_fecha, ocupacion, nacionalidad, religion, sexo, notas")
    .eq("user_id", userId).limit(5000);
  const idx = new Map<string, any>();
  const idxLoose = new Map<string, any>();
  for (const p of existentes ?? []) {
    const year = yearOf(p.nac_fecha || p.nac_fecha_aprox);
    idx.set(dedupeKey(p.nombres, p.apellidos, year), p);
    idxLoose.set(`${norm(p.nombres)}|${norm(p.apellidos)}`, p);
  }

  const refToId = new Map<string, string>();
  let personasCreadas = 0, personasReusadas = 0, personasActualizadas = 0;
  for (const p of ext.personas ?? []) {
    const year = yearOf(p.nac_fecha || p.nac_fecha_aprox);
    let existing = idx.get(dedupeKey(p.nombres, p.apellidos, year));
    if (!existing) existing = idxLoose.get(`${norm(p.nombres)}|${norm(p.apellidos)}`);

    if (existing) {
      const patch: any = {};
      const setIf = (k: string, v: any) => { if (v && !existing[k]) patch[k] = v; };
      setIf("sexo", p.sexo || null);
      setIf("nac_fecha", toDate(p.nac_fecha));
      setIf("nac_fecha_aprox", !toDate(p.nac_fecha) ? (p.nac_fecha_aprox || p.nac_fecha || null) : null);
      setIf("defuncion_fecha", toDate(p.defuncion_fecha));
      setIf("bautismo_fecha", toDate(p.bautismo_fecha));
      setIf("matrimonio_fecha", toDate(p.matrimonio_fecha));
      setIf("ocupacion", p.ocupacion || null);
      setIf("nacionalidad", p.nacionalidad || null);
      setIf("religion", p.religion || null);
      const extraNota = [p.notas, p.rol ? `Rol: ${p.rol}` : null, filename ? `Doc: ${filename}` : null].filter(Boolean).join(" · ");
      if (extraNota && !(existing.notas ?? "").includes(extraNota)) {
        patch.notas = [(existing.notas ?? "").trim(), extraNota].filter(Boolean).join("\n");
      }
      if (Object.keys(patch).length) { await sb.from("personas").update(patch).eq("id", existing.id); personasActualizadas++; }
      else personasReusadas++;
      refToId.set(p.ref, existing.id);
    } else {
      const row: any = {
        user_id: userId, nombres: p.nombres, apellidos: p.apellidos,
        sexo: p.sexo || null,
        nac_fecha: toDate(p.nac_fecha),
        nac_fecha_aprox: !toDate(p.nac_fecha) ? (p.nac_fecha_aprox || p.nac_fecha || null) : null,
        defuncion_fecha: toDate(p.defuncion_fecha),
        bautismo_fecha: toDate(p.bautismo_fecha),
        matrimonio_fecha: toDate(p.matrimonio_fecha),
        ocupacion: p.ocupacion || null, nacionalidad: p.nacionalidad || null, religion: p.religion || null,
        notas: [p.notas, p.rol ? `Rol: ${p.rol}` : null, filename ? `Doc: ${filename}` : null].filter(Boolean).join("\n"),
        certeza: "probable", viva: "desconocido",
        ids_externos: { extraido_de: filename ?? null, documento_id: documento_id ?? null },
      };
      const { data: ins, error } = await sb.from("personas").insert(row).select("id, nombres, apellidos, nac_fecha, nac_fecha_aprox").single();
      if (error) { console.error("insert persona", error); continue; }
      refToId.set(p.ref, ins.id);
      personasCreadas++;
      const y = yearOf(ins.nac_fecha || ins.nac_fecha_aprox);
      idx.set(dedupeKey(ins.nombres, ins.apellidos, y), ins);
      idxLoose.set(`${norm(ins.nombres)}|${norm(ins.apellidos)}`, ins);
    }
  }

  const { data: evExist } = await sb.from("eventos").select("persona_id, tipo, fecha, fecha_aprox").eq("user_id", userId).limit(10000);
  const evSeen = new Set((evExist ?? []).map((e: any) => `${e.persona_id}|${e.tipo}|${yearOf(e.fecha || e.fecha_aprox)}`));
  let eventosCreados = 0;
  for (const e of ext.eventos ?? []) {
    const pid = refToId.get(e.persona_ref);
    if (!pid) continue;
    const fecha = toDate(e.fecha);
    const y = yearOf(fecha || e.fecha_aprox || e.fecha);
    const key = `${pid}|${e.tipo}|${y}`;
    if (evSeen.has(key)) continue;
    const { error } = await sb.from("eventos").insert({
      user_id: userId, persona_id: pid, tipo: e.tipo, fecha,
      fecha_aprox: !fecha ? (e.fecha_aprox || e.fecha || null) : null,
      lugar_original: e.lugar || null, descripcion: e.descripcion || null, certeza: "probable",
    });
    if (!error) { eventosCreados++; evSeen.add(key); }
  }

  const { data: relExist } = await sb.from("relaciones").select("persona_id, pariente_id, tipo").eq("user_id", userId).limit(10000);
  const relSeen = new Set((relExist ?? []).map((r: any) => `${r.persona_id}|${r.pariente_id}|${r.tipo}`));
  let relacionesCreadas = 0;
  const tipoMap: Record<string, string> = { padre: "padre", madre: "madre", conyuge: "conyuge", hijo: "hijo", padrino: "padrino", madrina: "madrina", testigo: "testigo" };
  for (const r of ext.relaciones ?? []) {
    const a = refToId.get(r.a_ref), b = refToId.get(r.b_ref);
    if (!a || !b || a === b) continue;
    const tipo = tipoMap[r.tipo] ?? r.tipo;
    const key = `${a}|${b}|${tipo}`;
    if (relSeen.has(key)) continue;
    const { error } = await sb.from("relaciones").insert({
      user_id: userId, persona_id: a, pariente_id: b, tipo,
      naturaleza: "biologica", certeza: "probable",
    });
    if (!error) { relacionesCreadas++; relSeen.add(key); }
  }

  await sb.from("sugerencias").insert({
    user_id: userId, tipo: "extraccion_documento",
    titulo: `Documento leído: ${filename ?? ext.tipo_documento ?? "sin nombre"}`,
    descripcion: ext.resumen?.slice(0, 4000) ?? "",
    payload: {
      tipo_documento: ext.tipo_documento, fecha_documento: ext.fecha_documento, lugar_documento: ext.lugar_documento,
      transcripcion: (ext.transcripcion ?? "").slice(0, 8000), chunks: chunkPayloads.length,
      personasCreadas, personasReusadas, personasActualizadas, eventosCreados, relacionesCreadas,
      documento_id: documento_id ?? null,
    },
    confianza: 70, origen: "leer-documento-ia", estado: "pendiente",
  });

  await sb.from("actividad").insert({
    user_id: userId, tipo: "ia_lectura_documento",
    descripcion: `✅ "${filename ?? "documento"}" procesado (${chunkPayloads.length} ${chunkPayloads.length === 1 ? "parte" : "partes"}): +${personasCreadas} personas, ${personasActualizadas} actualizadas, ${eventosCreados} eventos, ${relacionesCreadas} relaciones`,
    metadata: { filename, chunks: chunkPayloads.length, personasCreadas, personasActualizadas, personasReusadas, eventosCreados, relacionesCreadas, estado: "completado" },
  });

  return {
    ok: true, resumen: ext.resumen, tipo_documento: ext.tipo_documento, chunks: chunkPayloads.length,
    personasCreadas, personasReusadas, personasActualizadas, eventosCreados, relacionesCreadas,
    transcripcion: (ext.transcripcion ?? "").slice(0, 4000),
  };
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
    const { background, ...params } = body as any;

    // Modo background: devolvemos rápido y procesamos con waitUntil
    if (background) {
      // @ts-ignore EdgeRuntime existe en Supabase Edge
      const ert: any = (globalThis as any).EdgeRuntime;
      const task = (async () => {
        try { await processDocument({ sb, userId: user.id, LOVABLE_API_KEY, ...params }); }
        catch (e: any) {
          console.error("bg fail", e);
          await sb.from("actividad").insert({
            user_id: user.id, tipo: "ia_lectura_documento_error",
            descripcion: `❌ Falló "${params.filename ?? "documento"}": ${e?.message ?? e}`,
            metadata: { filename: params.filename, estado: "error", error: String(e?.message ?? e) },
          });
        }
      })();
      if (ert?.waitUntil) ert.waitUntil(task);
      return new Response(JSON.stringify({
        ok: true, background: true,
        mensaje: "Procesando en segundo plano. Podés cambiar de sección, los resultados aparecerán en Inicio.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await processDocument({ sb, userId: user.id, LOVABLE_API_KEY, ...params });
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("leer-documento-ia", e);
    const msg = e?.message === "RATE_LIMIT" ? "Límite de IA alcanzado, esperá un minuto."
      : e?.message === "NO_CREDITS" ? "Sin créditos de IA."
      : (e instanceof Error ? e.message : "Error");
    const status = e?.message === "RATE_LIMIT" ? 429 : e?.message === "NO_CREDITS" ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

