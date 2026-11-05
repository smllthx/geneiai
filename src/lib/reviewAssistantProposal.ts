import type { TablesUpdate } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

type Proposal = { id: string; tipo: string; persona_id?: string | null; payload: Record<string, unknown> };
const editableFields = new Set(["nombres", "apellidos", "variantes_nombre", "sexo", "viva", "nac_fecha", "nac_fecha_aprox",
  "nac_rango_ini", "nac_rango_fin", "bautismo_fecha", "matrimonio_fecha", "defuncion_fecha", "entierro_fecha",
  "ocupacion", "nacionalidad", "religion", "notas", "certeza"]);
const relationTypes = new Set(["padre", "madre", "hijo", "conyuge", "hermano", "otro"]);

export async function applyAssistantProposal(proposal: Proposal, userId: string, treeId: string) {
  const p = proposal.payload;
  if (proposal.tipo === "nueva_relacion") {
    const source = String(p.source_id || ""), target = String(p.target_id || ""), tipo = String(p.tipo || "");
    if (!source || !target || source === target || !relationTypes.has(tipo)) throw new Error("Revisa las personas y el tipo de relación.");
    const { data, error } = await supabase.from("personas").select("id").eq("user_id", userId)
      .eq("arbol_id" as never, treeId).in("id", [source, target]);
    if (error) throw error;
    if (data.length !== 2) throw new Error("Ambas personas deben pertenecer al árbol activo.");
    const { error: insertError } = await supabase.from("relaciones").upsert({
      id: proposal.id, arbol_id: treeId, user_id: userId, persona_id: source, pariente_id: target, tipo,
    } as never, { onConflict: "id", ignoreDuplicates: true });
    if (insertError) throw insertError;
  } else if (proposal.tipo === "actualizar_persona" && proposal.persona_id) {
    const patch = Object.fromEntries(Object.entries(p).filter(([key]) => editableFields.has(key)));
    if (!Object.keys(patch).length) throw new Error("La propuesta no contiene campos editables.");
    let query = supabase.from("personas").update(patch as TablesUpdate<"personas">).eq("id", proposal.persona_id).eq("user_id", userId).eq("arbol_id" as never, treeId);
    if (Object.prototype.hasOwnProperty.call(p, "expected_current_notes")) {
      // Biography drafts carry the notes used to generate them. Preserve edits made since.
      query = p.expected_current_notes ? query.eq("notas", String(p.expected_current_notes)) : query.or('notas.is.null,notas.eq.""');
    }
    const { data, error } = await query.select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("La ficha cambió desde que se preparó la propuesta. Revisa sus notas antes de continuar.");
  } else if (proposal.tipo === "nueva_persona") {
    if (!p.nombres || !p.apellidos) throw new Error("Revisa los nombres y apellidos propuestos.");
    const fields = Object.fromEntries(Object.entries(p).filter(([key]) => editableFields.has(key)));
    const { error } = await supabase.from("personas").upsert({
      ...fields, id: proposal.id, user_id: userId, arbol_id: treeId,
    } as never, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw error;
  } else {
    throw new Error("Esta propuesta requiere revisión manual.");
  }
}
