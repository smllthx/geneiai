// Persists an ImportResult into Supabase (personas + relaciones).
// Marks every imported persona's `ids_externos.import_xref` so we can dedupe later.
import { supabase } from "@/integrations/supabase/client";
import type { ImportPersona, ImportFamilia } from "./gedcom";
import { inferLivingStatus, inferSexFromName } from "@/lib/personAutoRules";

export type ImportSummary = {
  personasCreadas: number;
  personasFusionadas: number;
  relacionesCreadas: number;
  errores: string[];
};

const norm = (s?: string) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const yearOf = (d?: string | null) => {
  if (!d) return null;
  const m = String(d).match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
};


export async function persistImport(
  data: { personas: ImportPersona[]; familias: ImportFamilia[] },
  source: string,
): Promise<ImportSummary> {
  const summary: ImportSummary = { personasCreadas: 0, personasFusionadas: 0, relacionesCreadas: 0, errores: [] };
  const userRes = await supabase.auth.getUser();
  const user = userRes.data.user;
  if (!user) {
    summary.errores.push("No hay sesión activa.");
    return summary;
  }

  const xrefToId = new Map<string, string>();

  // Pre-cargar personas del usuario para auto-merge alta confianza (nombre+apellido+año±2)
  const { data: existentes } = await supabase
    .from("personas")
    .select("id, nombres, apellidos, nac_fecha")
    .eq("user_id", user.id);
  const indice = new Map<string, { id: string; year: number | null }[]>();
  (existentes ?? []).forEach((e: any) => {
    const k = `${norm(e.nombres)}|${norm(e.apellidos)}`;
    const arr = indice.get(k) ?? [];
    arr.push({ id: e.id, year: yearOf(e.nac_fecha) });
    indice.set(k, arr);
  });

  const findMatch = (p: ImportPersona): string | null => {
    const k = `${norm(p.nombres)}|${norm(p.apellidos)}`;
    const cands = indice.get(k);
    if (!cands || !cands.length) return null;
    const y = yearOf(p.nac_fecha);
    // Si no hay año en el import o no en el candidato, igual fusionamos por nombre exacto.
    const match = cands.find((c) => {
      if (y == null || c.year == null) return true;
      return Math.abs(c.year - y) <= 2;
    });
    return match?.id ?? null;
  };

  // Separar personas a crear vs ya existentes (fusionar)
  const toInsert: { row: any; xref: string }[] = [];
  for (const p of data.personas) {
    const existingId = findMatch(p);
    if (existingId) {
      xrefToId.set(p.xref, existingId);
      summary.personasFusionadas += 1;
      continue;
    }
    toInsert.push({
      xref: p.xref,
      row: {
        user_id: user.id,
        nombres: p.nombres,
        apellidos: p.apellidos,
        sexo: p.sexo === "M" ? "masculino" : p.sexo === "F" ? "femenino" : inferSexFromName(p.nombres),
        nac_fecha: p.nac_fecha,
        defuncion_fecha: p.defuncion_fecha,
        bautismo_fecha: p.bautismo_fecha,
        ocupacion: p.ocupacion,
        notas: [`Importado desde ${source} (${p.xref}).`, p.notas].filter(Boolean).join("\n"),
        viva: p.defuncion_fecha ? "no" : p.viva ?? inferLivingStatus(p.nac_fecha, null) ?? "desconocido",
        certeza: "probable" as const,
        ids_externos: { import_xref: p.xref, import_source: source },
        enlaces: {},
      },
    });
  }

  // Insert en chunks de 200
  for (let i = 0; i < toInsert.length; i += 200) {
    const chunk = toInsert.slice(i, i + 200);
    const { data: inserted, error } = await supabase
      .from("personas")
      .insert(chunk.map((c) => c.row))
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
