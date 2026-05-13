// GEDCOM importer — parses .ged files into our schema-friendly shape.
// Uses parse-gedcom (returns the raw GEDCOM tree) and walks it.
import { parse as parseGed } from "parse-gedcom";

export type ImportPersona = {
  xref: string; // GEDCOM @I1@
  nombres: string;
  apellidos: string;
  sexo?: "M" | "F" | null;
  nac_fecha?: string | null;
  nac_lugar?: string | null;
  defuncion_fecha?: string | null;
  defuncion_lugar?: string | null;
  bautismo_fecha?: string | null;
  ocupacion?: string | null;
  notas?: string | null;
  viva?: "viva" | "fallecida" | "desconocido";
};

export type ImportFamilia = {
  xref: string;
  husband?: string;
  wife?: string;
  children: string[];
  marr_fecha?: string | null;
  marr_lugar?: string | null;
};

export type ImportResult = {
  personas: ImportPersona[];
  familias: ImportFamilia[];
};

const get = (node: any, tag: string) =>
  node?.tree?.find((c: any) => c.tag === tag);
const getAll = (node: any, tag: string) =>
  node?.tree?.filter((c: any) => c.tag === tag) ?? [];
const val = (node: any) => (node ? (node.data ?? "").trim() : "");

// GEDCOM date: keep as text — too many formats. Try ISO if obvious.
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
  const y = s.match(/^(\d{4})$/);
  if (y) return `${y[1]}-01-01`;
  return null; // we'll keep raw in notes
}

function splitName(fullName: string): { nombres: string; apellidos: string } {
  // GEDCOM: "John /Smith/"
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
  const tree = parseGed(text);
  const personas: ImportPersona[] = [];
  const familias: ImportFamilia[] = [];

  for (const node of tree) {
    if (node.tag === "INDI") {
      const nameNode = get(node, "NAME");
      const fullName = val(nameNode) || "";
      const { nombres, apellidos } = splitName(fullName);
      const sex = val(get(node, "SEX")) as "M" | "F" | "";
      const birt = get(node, "BIRT");
      const deat = get(node, "DEAT");
      const bapm = get(node, "BAPM") || get(node, "CHR");
      const occu = val(get(node, "OCCU"));
      const noteNodes = getAll(node, "NOTE");
      const notes = noteNodes.map((n: any) => val(n)).filter(Boolean).join("\n");

      const birthDateRaw = val(get(birt, "DATE"));
      const deathDateRaw = val(get(deat, "DATE"));
      const baptDateRaw = val(get(bapm, "DATE"));

      const extraNotes: string[] = [];
      if (birthDateRaw && !normDate(birthDateRaw)) extraNotes.push(`Nac. (texto): ${birthDateRaw}`);
      if (deathDateRaw && !normDate(deathDateRaw)) extraNotes.push(`Def. (texto): ${deathDateRaw}`);
      if (notes) extraNotes.push(notes);

      personas.push({
        xref: node.pointer,
        nombres,
        apellidos,
        sexo: sex === "M" || sex === "F" ? sex : null,
        nac_fecha: normDate(birthDateRaw),
        nac_lugar: val(get(birt, "PLAC")) || null,
        defuncion_fecha: normDate(deathDateRaw),
        defuncion_lugar: val(get(deat, "PLAC")) || null,
        bautismo_fecha: normDate(baptDateRaw),
        ocupacion: occu || null,
        notas: extraNotes.join("\n") || null,
        viva: deat ? "fallecida" : "desconocido",
      });
    } else if (node.tag === "FAM") {
      const marr = get(node, "MARR");
      familias.push({
        xref: node.pointer,
        husband: val(get(node, "HUSB")) || undefined,
        wife: val(get(node, "WIFE")) || undefined,
        children: getAll(node, "CHIL").map((c: any) => val(c)).filter(Boolean),
        marr_fecha: normDate(val(get(marr, "DATE"))),
        marr_lugar: val(get(marr, "PLAC")) || null,
      });
    }
  }

  return { personas, familias };
}
