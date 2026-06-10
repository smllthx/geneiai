import { getActiveTreeId, getSupabase, getUserOrThrow, json, limitPublicDocumentText, openAIJson, suggestionTitle } from "../_lib/geneai.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Método no permitido" });
  try {
    const sb = getSupabase(req);
    const user = await getUserOrThrow(sb);
    const treeId = await getActiveTreeId(sb, user.id);
    const { document_id, text } = req.body ?? {};

    let documentId = document_id as string | undefined;
    let documentText = String(text ?? "");
    let documentTitle = "Documento sin título";

    if (documentId) {
      const { data, error } = await sb
        .from("documentos")
        .select("id,titulo,transcripcion,ocr_texto,resumen,cita,repositorio,arbol_id")
        .eq("id", documentId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Documento no encontrado");
      documentTitle = (data as any).titulo ?? documentTitle;
      documentText = [
        (data as any).transcripcion,
        (data as any).ocr_texto,
        (data as any).resumen,
        (data as any).cita,
        (data as any).repositorio,
      ].filter(Boolean).join("\n\n");
    }

    const sanitized = limitPublicDocumentText(documentText);
    if (!sanitized.trim()) throw new Error("No hay texto documental para analizar");

    const extracted = await openAIJson(sb, [
      {
        role: "system",
        content: "Eres un genealogista experto. Extrae datos explícitos de documentos históricos. No inventes. Usa español neutral. Marca confianza 0-100.",
      },
      {
        role: "user",
        content: `Documento: ${documentTitle}\n\nTexto:\n${sanitized}`,
      },
    ], `{
  "summary": "resumen breve",
  "names": [{"full_name":"", "given_names":"", "surnames":"", "role":"", "confidence":80}],
  "dates": [{"value":"YYYY-MM-DD o texto aproximado", "type":"nacimiento|matrimonio|defuncion|otro", "person_name":"", "confidence":80}],
  "locations": [{"value":"", "type":"nacimiento|matrimonio|defuncion|residencia|otro", "confidence":80}],
  "relationships": [{"person_a":"", "person_b":"", "relationship":"padre|madre|conyuge|hijo|testigo|otro", "evidence":"", "confidence":80}],
  "events": [{"person_name":"", "event_type":"", "date":"", "place":"", "description":"", "confidence":80}]
}`);

    if (documentId) {
      const row = {
        user_id: user.id,
        arbol_id: treeId,
        document_id: documentId,
        names: extracted.names ?? [],
        dates: extracted.dates ?? [],
        locations: extracted.locations ?? [],
        relationships: extracted.relationships ?? [],
        events: extracted.events ?? [],
        summary: String(extracted.summary ?? ""),
        model: "gpt-4o-mini",
      };
      const { error } = await sb.from("document_ai_data").upsert(row, { onConflict: "user_id,document_id" });
      if (error) throw error;

      const suggestions = Array.isArray(extracted.relationships)
        ? extracted.relationships.slice(0, 20).map((rel: any) => ({
          user_id: user.id,
          arbol_id: treeId,
          person_id: null,
          suggestion_type: "relacion",
          title: suggestionTitle("relacion"),
          description: `${rel.person_a ?? "Persona"} ↔ ${rel.person_b ?? "persona"}: ${rel.relationship ?? "relación"}`,
          details: { ...rel, document_id: documentId, document_title: documentTitle },
          confidence: Number(rel.confidence ?? 60),
          status: "pendiente",
        }))
        : [];
      if (suggestions.length) {
        const { error } = await sb.from("ai_suggestions").insert(suggestions);
        if (error) throw error;
      }
    }

    return json(res, 200, { ok: true, data: extracted });
  } catch (e: any) {
    return json(res, e?.message === "No autenticado" ? 401 : 500, { error: e?.message ?? "No se pudo analizar el documento" });
  }
}
