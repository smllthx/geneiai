// CSV / Excel / JSON tabular importers.
// Expected columns (insensitive): id, nombres, apellidos, sexo, nac_fecha,
// nac_lugar, defuncion_fecha, defuncion_lugar, padre_id, madre_id, conyuge_id, notas
import * as XLSX from "xlsx";
import type { ImportPersona, ImportFamilia } from "./gedcom";

export type TabularRow = Record<string, string>;

const norm = (k: string) => k.trim().toLowerCase().replace(/\s+/g, "_");

export function parseTabular(rows: TabularRow[]): { personas: ImportPersona[]; familias: ImportFamilia[] } {
  const personas: ImportPersona[] = [];
  const famMap = new Map<string, ImportFamilia>();
  const childToParents = new Map<string, { padre?: string; madre?: string }>();

  rows.forEach((raw, i) => {
    const r: TabularRow = {};
    for (const k of Object.keys(raw)) r[norm(k)] = String(raw[k] ?? "").trim();
    const xref = r.id || `@ROW${i + 1}@`;
    const nombres = r.nombres || r.nombre || "(sin nombre)";
    const apellidos = r.apellidos || r.apellido || "(sin apellido)";
    const sexoRaw = (r.sexo || "").toUpperCase();
    personas.push({
      xref,
      nombres,
      apellidos,
      sexo: sexoRaw === "M" || sexoRaw === "F" ? (sexoRaw as "M" | "F") : null,
      nac_fecha: r.nac_fecha || null,
      nac_lugar: r.nac_lugar || null,
      defuncion_fecha: r.defuncion_fecha || null,
      defuncion_lugar: r.defuncion_lugar || null,
      bautismo_fecha: r.bautismo_fecha || null,
      ocupacion: r.ocupacion || null,
      notas: r.notas || null,
      viva: r.defuncion_fecha ? "no" : "desconocido",
    });
    if (r.padre_id || r.madre_id) {
      childToParents.set(xref, { padre: r.padre_id || undefined, madre: r.madre_id || undefined });
    }
    if (r.conyuge_id) {
      const key = [xref, r.conyuge_id].sort().join("__");
      const existing = famMap.get(key);
      if (!existing) famMap.set(key, { xref: `@F${famMap.size + 1}@`, husband: xref, wife: r.conyuge_id, children: [] });
    }
  });

  // Build families from parent-child relationships
  for (const [child, p] of childToParents) {
    const key = [p.padre || "", p.madre || ""].join("__");
    if (!key.replace(/_/g, "")) continue;
    let fam = famMap.get(key);
    if (!fam) {
      fam = { xref: `@F${famMap.size + 1}@`, husband: p.padre, wife: p.madre, children: [] };
      famMap.set(key, fam);
    }
    fam.children.push(child);
  }

  return { personas, familias: Array.from(famMap.values()) };
}

export async function readCSV(file: File): Promise<TabularRow[]> {
  const text = await file.text();
  const wb = XLSX.read(text, { type: "string" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" }) as TabularRow[];
}

export async function readXLSX(file: File): Promise<TabularRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" }) as TabularRow[];
}

export async function readJSON(file: File): Promise<{ personas: ImportPersona[]; familias: ImportFamilia[] }> {
  const text = await file.text();
  const data = JSON.parse(text);
  // Support our own export shape OR a flat array of rows
  if (Array.isArray(data)) return parseTabular(data);
  if (data.personas && data.familias) return data;
  if (data.personas) return { personas: data.personas, familias: [] };
  throw new Error("JSON no reconocido. Esperado: { personas: [], familias: [] } o un arreglo de filas.");
}
