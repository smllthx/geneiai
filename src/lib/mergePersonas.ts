import { supabase } from "@/integrations/supabase/client";

/**
 * Fusiona la persona "source" dentro de "target":
 *  - Reasigna relaciones, eventos, foto_tags, fotos.personas_ids,
 *    documentos.personas_mencionadas, dna_estimates, hipotesis.personas,
 *    contradicciones.personas, coincidencias.ref_a/ref_b.
 *  - Rellena campos vacíos del target con los del source.
 *  - Concatena notas.
 *  - Elimina la persona source.
 *
 * Devuelve un resumen con cuántos registros se reasignaron.
 */
export async function fusionarPersonas(targetId: string, sourceId: string) {
  if (targetId === sourceId) throw new Error("Debes elegir dos personas distintas");

  const [{ data: target }, { data: source }] = await Promise.all([
    supabase.from("personas").select("*").eq("id", targetId).maybeSingle(),
    supabase.from("personas").select("*").eq("id", sourceId).maybeSingle(),
  ]);
  if (!target || !source) throw new Error("No se encontraron las personas");

  const summary: Record<string, number> = {};

  // 1) Reasignar relaciones (persona_id y pariente_id)
  const { count: r1 } = await supabase.from("relaciones").update({ persona_id: targetId }).eq("persona_id", sourceId).select("*", { count: "exact", head: true });
  const { count: r2 } = await supabase.from("relaciones").update({ pariente_id: targetId }).eq("pariente_id", sourceId).select("*", { count: "exact", head: true });
  summary.relaciones = (r1 ?? 0) + (r2 ?? 0);

  // Eliminar autorelaciones que pudieran quedar (persona_id == pariente_id)
  await supabase.from("relaciones").delete().eq("persona_id", targetId).eq("pariente_id", targetId);

  // 2) Eventos
  const { count: e } = await supabase.from("eventos").update({ persona_id: targetId }).eq("persona_id", sourceId).select("*", { count: "exact", head: true });
  summary.eventos = e ?? 0;

  // 3) Foto tags
  const { count: ft } = await supabase.from("foto_tags").update({ persona_id: targetId }).eq("persona_id", sourceId).select("*", { count: "exact", head: true });
  summary.foto_tags = ft ?? 0;

  // 4) Fotos.personas_ids (array)
  const { data: fotos } = await supabase.from("fotos").select("id,personas_ids").contains("personas_ids", [sourceId]);
  for (const f of fotos ?? []) {
    const nuevos = Array.from(new Set((f.personas_ids ?? []).map((x: string) => (x === sourceId ? targetId : x))));
    await supabase.from("fotos").update({ personas_ids: nuevos }).eq("id", f.id);
  }
  summary.fotos = (fotos ?? []).length;

  // 5) Documentos.personas_mencionadas (array uuid)
  const { data: docs } = await supabase.from("documentos").select("id,personas_mencionadas").contains("personas_mencionadas", [sourceId]);
  for (const d of docs ?? []) {
    const nuevos = Array.from(new Set((d.personas_mencionadas ?? []).map((x: string) => (x === sourceId ? targetId : x))));
    await supabase.from("documentos").update({ personas_mencionadas: nuevos }).eq("id", d.id);
  }
  summary.documentos = (docs ?? []).length;

  // 6) DNA estimates
  const { count: dna } = await supabase.from("dna_estimates").update({ persona_id: targetId }).eq("persona_id", sourceId).select("*", { count: "exact", head: true });
  summary.dna = dna ?? 0;

  // 7) Hipótesis.personas (array)
  const { data: hips } = await supabase.from("hipotesis").select("id,personas").contains("personas", [sourceId]);
  for (const h of hips ?? []) {
    const nuevos = Array.from(new Set((h.personas ?? []).map((x: string) => (x === sourceId ? targetId : x))));
    await supabase.from("hipotesis").update({ personas: nuevos }).eq("id", h.id);
  }
  summary.hipotesis = (hips ?? []).length;

  // 8) Contradicciones.personas (array)
  const { data: cons } = await supabase.from("contradicciones").select("id,personas").contains("personas", [sourceId]);
  for (const c of cons ?? []) {
    const nuevos = Array.from(new Set((c.personas ?? []).map((x: string) => (x === sourceId ? targetId : x))));
    await supabase.from("contradicciones").update({ personas: nuevos }).eq("id", c.id);
  }
  summary.contradicciones = (cons ?? []).length;

  // 9) Coincidencias (ref_a / ref_b) — eliminar las que queden de A↔A
  await supabase.from("coincidencias").update({ ref_a: targetId }).eq("ref_a", sourceId);
  await supabase.from("coincidencias").update({ ref_b: targetId }).eq("ref_b", sourceId);
  await supabase.from("coincidencias").delete().eq("ref_a", targetId).eq("ref_b", targetId);

  // 10) Foto principal / variantes / notas / campos vacíos
  const patch: any = {};
  const mergeText = (a?: string | null, b?: string | null) => {
    const aa = (a ?? "").trim(); const bb = (b ?? "").trim();
    if (!aa) return bb; if (!bb) return aa;
    if (aa.includes(bb) || bb.includes(aa)) return aa;
    return `${aa}\n\n— Fusionado desde duplicado —\n${bb}`;
  };

  const fillKeys = [
    "sexo", "foto_url", "ocupacion", "nacionalidad", "religion",
    "nac_fecha", "nac_fecha_aprox", "nac_rango_ini", "nac_rango_fin", "nac_lugar_id",
    "bautismo_fecha", "bautismo_lugar_id",
    "matrimonio_fecha", "matrimonio_lugar_id",
    "defuncion_fecha", "defuncion_lugar_id",
    "entierro_fecha", "entierro_lugar_id",
  ];
  for (const k of fillKeys) {
    if ((target as any)[k] == null || (target as any)[k] === "") {
      if ((source as any)[k] != null && (source as any)[k] !== "") patch[k] = (source as any)[k];
    }
  }
  patch.notas = mergeText(target.notas, source.notas);
  patch.variantes_nombre = Array.from(new Set([
    ...(target.variantes_nombre ?? []),
    ...(source.variantes_nombre ?? []),
    `${source.nombres} ${source.apellidos}`.trim(),
  ])).filter(Boolean);

  if (Object.keys(patch).length > 0) {
    await supabase.from("personas").update(patch).eq("id", targetId);
  }

  // 11) Eliminar source
  const { error: delErr } = await supabase.from("personas").delete().eq("id", sourceId);
  if (delErr) throw delErr;

  return { summary, target, source };
}
