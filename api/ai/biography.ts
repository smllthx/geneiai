import { getActiveTreeId, getSupabase, getUserOrThrow, json, openAIJson } from "../_lib/geneai.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "Método no permitido" });
  try {
    const sb = getSupabase(req);
    const user = await getUserOrThrow(sb);
    const treeId = await getActiveTreeId(sb, user.id);
    const { person_id } = req.body ?? {};
    if (!person_id) throw new Error("Falta person_id");

    const [{ data: persona }, { data: eventos }, { data: relaciones }, { data: documentos }] = await Promise.all([
      sb.from("personas").select("id,nombres,apellidos,sexo,nac_fecha,nac_fecha_aprox,defuncion_fecha,nacionalidad,ocupacion,religion,viva,notas").eq("id", person_id).maybeSingle(),
      sb.from("eventos").select("tipo,fecha,fecha_aprox,lugar_original,descripcion,certeza").eq("persona_id", person_id).order("fecha", { ascending: true }).limit(80),
      sb.from("relaciones").select("tipo,pariente_id,persona_id,notas").or(`persona_id.eq.${person_id},pariente_id.eq.${person_id}`).limit(120),
      sb.from("documentos").select("id,titulo,tipo,fecha,resumen,cita").contains("personas_mencionadas", [person_id]).limit(30),
    ]);
    if (!persona) throw new Error("Persona no encontrada");

    const snapshot = {
      persona: {
        nombres: (persona as any).nombres,
        apellidos: (persona as any).apellidos,
        sexo: (persona as any).sexo,
        nacimiento: (persona as any).nac_fecha ?? (persona as any).nac_fecha_aprox,
        defuncion: (persona as any).defuncion_fecha,
        viva: (persona as any).viva,
        nacionalidad: (persona as any).nacionalidad,
        ocupacion: (persona as any).ocupacion,
        religion: (persona as any).religion,
      },
      eventos: eventos ?? [],
      relaciones: relaciones ?? [],
      fuentes: documentos ?? [],
    };

    const ai = await openAIJson(sb, [
      {
        role: "system",
        content: "Eres un biógrafo genealógico. Escribe en español neutral, claro y verificable. No inventes datos; si faltan, dilo. Máximo 2000 caracteres.",
      },
      { role: "user", content: JSON.stringify(snapshot) },
    ], `{
  "biography_text":"biografía narrativa breve, sin inventar",
  "missing_data":["dato faltante"],
  "confidence":70
}`);

    const biography = String((ai as any).biography_text ?? "").slice(0, 2200).trim();
    if (!biography) throw new Error("La IA no generó biografía");
    const row = {
      user_id: user.id,
      arbol_id: treeId,
      person_id,
      biography_text: biography,
      editable_text: biography,
      source_snapshot: snapshot,
      model: "gpt-4o-mini",
      generated_by: user.id,
      status: "draft",
      confidence: Math.max(0, Math.min(100, Number((ai as any).confidence ?? 60))),
    };
    const { data, error } = await sb.from("ai_biographies").insert(row).select("*").single();
    if (error) throw error;
    return json(res, 200, { ok: true, biography: data });
  } catch (e: any) {
    return json(res, e?.message === "No autenticado" ? 401 : 500, { error: e?.message ?? "No se pudo generar la biografía" });
  }
}
