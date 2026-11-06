// GEDCOM importer — parses .ged files into our schema-friendly shape.
import { parse as parseGed } from "parse-gedcom";

export type ImportPersona = {
  xref: string;
  nombres: string;
  apellidos: string;
  sexo?: "M" | "F" | null;
  nac_fecha?: string | null;
  nac_fecha_aprox?: string | null;
  nac_rango_ini?: number | null;
  nac_rango_fin?: number | null;
  nac_lugar?: string | null;
  defuncion_fecha?: string | null;
  defuncion_lugar?: string | null;
  bautismo_fecha?: string | null;
  ocupacion?: string | null;
  notas?: string | null;
  viva?: "si" | "no" | "desconocido";
};

export type ImportFamilia = {
  xref: string;
  husband?: string;
  wife?: string;
  children: string[];
  marr_fecha?: string | null;
  marr_lugar?: string | null;
};

export type ImportResult = { personas: ImportPersona[]; familias: ImportFamilia[] };

type Node = { type: string; value?: string; data?: any; children?: Node[] };

const child = (n: Node | undefined, type: string): Node | undefined =>
  n?.children?.find((c) => c.type === type);
const childrenOf = (n: Node | undefined, type: string): Node[] =>
  n?.children?.filter((c) => c.type === type) ?? [];
const nodeText = (n: Node | undefined): string => {
  if (!n) return "";
  return ((n.value ?? n.data?.pointer ?? "").toString() + (n.children ?? []).filter(c => c.type === "CONT" || c.type === "CONC")
    .map(c => (c.type === "CONT" ? "\n" : "") + nodeText(c)).join(""));
};

const v = (n: Node | undefined) => nodeText(n).trim();

function normDate(s: string): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/i);
  if (m) {
    const months: Record<string, string> = {
      JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
      JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
    };
    const mm = months[m[2].toUpperCase()];
    if (mm) return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
  }
  const my = s.match(/^([A-Z]{3})\s+(\d{4})$/i);
  if (my) {
    const months: Record<string, string> = {
      JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
      JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
    };
    const mm = months[my[1].toUpperCase()];
    if (mm) return `${my[2]}-${mm}-01`;
  }
  const y = s.match(/^(\d{4})$/);
  if (y) return `${y[1]}-01-01`;
  return null;
}

/** Preserve the precision of a birth record. A year alone is a known year, not January 1. */
export function importedBirth(raw: string) {
  const value = raw.trim();
  if (!value) return {};
  if (/^\d{3,4}$/.test(value)) return { nac_rango_ini: Number(value), nac_rango_fin: Number(value) };
  const exact = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value
    : /^\d{1,2}\s+[A-Z]{3}\s+\d{4}$/i.test(value) ? normDate(value) : null;
  if (exact) return { nac_fecha: exact };
  return { nac_fecha_aprox: value };
}

function splitName(fullName: string): { nombres: string; apellidos: string } {
  const m = fullName.match(/^(.*?)\/([^/]*)\/(.*)$/);
  if (m) {
    return {
      nombres: (m[1] + " " + m[3]).trim() || "(sin nombre)",
      apellidos: m[2].trim() || "(sin apellido)",
    };
  }
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { nombres: parts[0] || "(sin nombre)", apellidos: "(sin apellido)" };
  return { nombres: parts.slice(0, -1).join(" "), apellidos: parts[parts.length - 1] };
}

export function parseGedcom(text: string): ImportResult {
  const tree = parseGed(text) as unknown as { children: Node[] };
  const personas: ImportPersona[] = [];
  const familias: ImportFamilia[] = [];

  for (const node of tree.children ?? []) {
    if (node.type === "INDI") {
      const xref = node.data?.xref_id ?? "";
      const fullName = v(child(node, "NAME"));
      const { nombres, apellidos } = splitName(fullName);
      const sex = v(child(node, "SEX")) as "M" | "F" | "";
      const birt = child(node, "BIRT");
      const deat = child(node, "DEAT");
      const bapm = child(node, "BAPM") ?? child(node, "CHR");
      const occu = v(child(node, "OCCU"));
      const noteText = childrenOf(node, "NOTE").map(v).filter(Boolean).join("\n");

      const birthDateRaw = v(child(birt, "DATE"));
      const deathDateRaw = v(child(deat, "DATE"));
      const baptDateRaw = v(child(bapm, "DATE"));

      const extraNotes: string[] = [];
      if (deathDateRaw && !normDate(deathDateRaw)) extraNotes.push(`Def. (texto): ${deathDateRaw}`);
      if (noteText) extraNotes.push(noteText);

      personas.push({
        xref,
        nombres,
        apellidos,
        sexo: sex === "M" || sex === "F" ? sex : null,
        ...importedBirth(birthDateRaw),
        nac_lugar: v(child(birt, "PLAC")) || null,
        defuncion_fecha: normDate(deathDateRaw),
        defuncion_lugar: v(child(deat, "PLAC")) || null,
        bautismo_fecha: normDate(baptDateRaw),
        ocupacion: occu || null,
        notas: extraNotes.join("\n") || null,
        viva: deat ? "no" : "desconocido",
      });
    } else if (node.type === "FAM") {
      const marr = child(node, "MARR");
      familias.push({
        xref: node.data?.xref_id ?? "",
        husband: v(child(node, "HUSB")) || undefined,
        wife: v(child(node, "WIFE")) || undefined,
        children: childrenOf(node, "CHIL").map(v).filter(Boolean),
        marr_fecha: normDate(v(child(marr, "DATE"))),
        marr_lugar: v(child(marr, "PLAC")) || null,
      });
    }
  }

  return { personas, familias };
}
