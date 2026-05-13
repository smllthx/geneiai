// Persists an ImportResult into Supabase (personas + relaciones).
// Marks every imported persona's `ids_externos.import_xref` so we can dedupe later.
import { supabase } from "@/integrations/supabase/client";
import type { ImportPersona, ImportFamilia } from "./gedcom";

export type ImportSummary = {
  personasCreadas: number;
  relacionesCreadas: number;
  errores: string[];
};

export async function persistImport(
  data: { personas: ImportPersona[]; familias: ImportFamilia[] },
  source: string,
): Promise<ImportSummary> {
  const summary: ImportSummary = { personasCreadas: 0, relacionesCreadas: 0, errores: [] };
  const userRes = await supabase.auth.getUser();
  const user = userRes.data.user;
  if (!user) {
    summary.errores.push("No hay sesión activa.");
    return summary;
  }

  const xrefToId = new Map<string, string>();

  // Insert personas in batches
  const rows = data.personas.map((p) => ({
    user_id: user.id,
    nombres: p.nombres,
    apellidos: p.apellidos,
    sexo: p.sexo,
    nac_fecha: p.nac_fecha,
    defuncion_fecha: p.defuncion_fecha,
    bautismo_fecha: p.bautismo_fecha,
    ocupacion: p.ocupacion,
    notas: [`Importado desde ${source} (${p.xref}).`, p.notas].filter(Boolean).join("\n"),
    viva: p.viva ?? "desconocido",
    certeza: "probable" as const,
    ids_externos: { import_xref: p.xref, import_source: source },
    enlaces: {},
  }));

  // Insert in chunks of 200
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { data: inserted, error } = await supabase
      .from("personas")
      .insert(chunk)
      .select("id, ids_externos");
    if (error) {
      summary.errores.push(`Personas ${i}-${i + chunk.length}: ${error.message}`);
      continue;
    }
    inserted?.forEach((row: any) => {
      const xref = row.ids_externos?.import_xref;
      if (xref) xrefToId.set(xref, row.id);
    });
    summary.personasCreadas += inserted?.length ?? 0;
  }

  // Build relaciones from familias
  const relaciones: Array<{
    user_id: string;
    persona_id: string;
    pariente_id: string;
    tipo: "padre" | "madre" | "conyuge" | "hijo";
    naturaleza: "biologica";
    certeza: "probable";
  }> = [];

  for (const fam of data.familias) {
    const husbId = fam.husband ? xrefToId.get(fam.husband) : undefined;
    const wifeId = fam.wife ? xrefToId.get(fam.wife) : undefined;

    if (husbId && wifeId) {
      relaciones.push(
        { user_id: user.id, persona_id: husbId, pariente_id: wifeId, tipo: "conyuge", naturaleza: "biologica", certeza: "probable" },
        { user_id: user.id, persona_id: wifeId, pariente_id: husbId, tipo: "conyuge", naturaleza: "biologica", certeza: "probable" },
      );
    }
    for (const childXref of fam.children) {
      const childId = xrefToId.get(childXref);
      if (!childId) continue;
      if (husbId) {
        relaciones.push(
          { user_id: user.id, persona_id: childId, pariente_id: husbId, tipo: "padre", naturaleza: "biologica", certeza: "probable" },
          { user_id: user.id, persona_id: husbId, pariente_id: childId, tipo: "hijo", naturaleza: "biologica", certeza: "probable" },
        );
      }
      if (wifeId) {
        relaciones.push(
          { user_id: user.id, persona_id: childId, pariente_id: wifeId, tipo: "madre", naturaleza: "biologica", certeza: "probable" },
          { user_id: user.id, persona_id: wifeId, pariente_id: childId, tipo: "hijo", naturaleza: "biologica", certeza: "probable" },
        );
      }
    }
  }

  for (let i = 0; i < relaciones.length; i += 200) {
    const chunk = relaciones.slice(i, i + 200);
    const { error, count } = await supabase.from("relaciones").insert(chunk, { count: "exact" });
    if (error) {
      summary.errores.push(`Relaciones ${i}-${i + chunk.length}: ${error.message}`);
      continue;
    }
    summary.relacionesCreadas += count ?? chunk.length;
  }

  return summary;
}
