import { getActiveTreeId, getSupabase, getUserOrThrow, json, openAIJson, suggestionTitle } from "../_lib/geneai.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Método no permitido" });
  try {
    const sb = getSupabase(req);
    const user = await getUserOrThrow(sb);
    const treeId = await getActiveTreeId(sb, user.id);
    const { person_id } = req.body ?? {};
    if (!person_id) throw new Error("Falta person_id");

    const [{ data: persona, error: personaError }, { data: relaciones }, { data: candidatos }, { data: documentos }] = await Promise.all([
      sb.from("personas").select("id,nombres,apellidos,sexo,nac_fecha,nac_fecha_aprox,defuncion_fecha,nacionalidad,ocupacion,notas,arbol_id").eq("id", person_id).maybeSingle(),
      sb.from("relaciones").select("tipo,persona_id,pariente_id,notas").or(`persona_id.eq.${person_id},pariente_id.eq.${person_id}`).limit(120),
      sb.from("personas").select("id,nombres,apellidos,sexo,nac_fecha,nac_fecha_aprox,defuncion_fecha,nacionalidad,arbol_id").limit(250),
      sb.from("documentos").select("id,titulo,resumen,fecha,personas_mencionadas").contains("personas_mencionadas", [person_id]).limit(25),
    ]);
    if (personaError) throw personaError;
    if (!persona) throw new Error("Persona no encontrada");

    const publicContext = {
      persona: {
        id: (persona as any).id,
        nombres: (persona as any).nombres,
        apellidos: (persona as any).apellidos,
        sexo: (persona as any).sexo,
        nacimiento: (persona as any).nac_fecha ?? (persona as any).nac_fecha_aprox,
        defuncion: (persona as any).defuncion_fecha,
        nacionalidad: (persona as any).nacionalidad,
      },
      relaciones_existentes: relaciones ?? [],
      candidatos: (candidatos ?? []).map((p: any) => ({
        id: p.id,
        nombres: p.nombres,
        apellidos: p.apellidos,
        sexo: p.sexo,
        nacimiento: p.nac_fecha ?? p.nac_fecha_aprox,
        defuncion: p.defuncion_fecha,
        nacionalidad: p.nacionalidad,
      })),
      documentos: (documentos ?? []).map((d: any) => ({ id: d.id, titulo: d.titulo, fecha: d.fecha, resumen: d.resumen })),
    };

    const ai = await openAIJson(sb, [
      {
        role: "system",
        content: "Eres un asistente de investigación genealógica. Sugiere hipótesis revisables, no confirmaciones. No inventes datos y evita información sensible.",
      },
      { role: "user", content: JSON.stringify(publicContext) },
    ], `{
  "suggestions": [
    {
      "suggestion_type":"relacion|duplicado|evento",
      "target_person_id":"uuid si existe",
      "relation_type":"padre|madre|conyuge|hijo|hermano|otro",
      "title":"",
      "description":"",
      "evidence":"",
      "confidence":70
    }
  ]
}`);

    const rows = Array.isArray((ai as any).suggestions) ? (ai as any).suggestions.slice(0, 30).map((s: any) => ({
      user_id: user.id,
      arbol_id: treeId,
      person_id,
      suggestion_type: ["relacion", "duplicado", "evento"].includes(s.suggestion_type) ? s.suggestion_type : "relacion",
      title: s.title || suggestionTitle(s.suggestion_type),
      description: s.description || s.evidence || "Sugerencia generada por IA",
      details: {
        ...s,
        source_person_id: person_id,
        target_person_id: s.target_person_id ?? null,
      },
      confidence: Math.max(0, Math.min(100, Number(s.confidence ?? 60))),
      status: "pendiente",
    })) : [];

    if (rows.length) {
      const { error } = await sb.from("ai_suggestions").insert(rows);
      if (error) throw error;
    }

    return json(res, 200, { ok: true, created: rows.length, suggestions: rows });
  } catch (e: any) {
    return json(res, e?.message === "No autenticado" ? 401 : 500, { error: e?.message ?? "No se pudieron generar sugerencias" });
  }
}
