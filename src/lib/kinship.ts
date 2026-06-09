// Unified kinship helpers — single source of truth for family relationships across
// the tree, the person detail view, and any other panel that needs to derive
// parents/children/spouses/siblings from the `relaciones` table.

import type { PersonaLite } from "@/components/PersonCard";
import { inferSexFromName } from "@/lib/personAutoRules";

export type RelTipo = "padre" | "madre" | "hijo" | "conyuge" | "hermano";

export type RelRow = {
  id: string;
  persona_id: string;
  pariente_id: string;
  tipo: RelTipo | string;
  notas?: string | null;
};

const cleanTipo = (tipo?: string | null) =>
  (tipo ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export const yearOf = (p?: { nac_fecha?: string | null; nac_rango_ini?: number | null }) => {
  if (!p) return 9999;
  if (p.nac_fecha) return new Date(p.nac_fecha).getUTCFullYear();
  return p.nac_rango_ini ?? 9999;
};

export const sortByBirth = <T extends { nac_fecha?: string | null; nac_rango_ini?: number | null }>(a: T, b: T) =>
  yearOf(a) - yearOf(b);

/** Sky for paternal line, pink for maternal line — consistent across all views. */
export const lineColor = (sexo?: string | null) =>
  sexo === "femenino" ? "pink" : sexo === "masculino" ? "sky" : "neutral";

const sexOf = (p?: PersonaLite | null) => p?.sexo ?? inferSexFromName(p?.nombres) ?? null;

const fatherTypes = new Set(["padre", "progenitor", "father"]);
const motherTypes = new Set(["madre", "progenitora", "mother"]);
const childTypes = new Set(["hijo", "hija", "child"]);
const siblingTypes = new Set(["hermano", "hermana", "sibling"]);
const spouseTypes = new Set([
  "conyuge",
  "conjuge",
  "esposo",
  "esposa",
  "pareja",
  "matrimonio",
  "union",
  "union civil",
  "conviviente",
  "convivencia",
  "cohabitante",
  "cohabitacion",
]);

const spouseLikeNotes = ["unión civil", "union civil", "conviviente", "convivencia", "cohabitante", "cohabitación", "cohabitacion", "matrimonio", "pareja"];

export const isSpouseLikeRelation = (r: Pick<RelRow, "tipo" | "notas">) => {
  const tipo = cleanTipo(r.tipo);
  if (spouseTypes.has(tipo)) return true;
  if (tipo !== "otro") return false;
  const notas = (r.notas ?? "").toLowerCase();
  return spouseLikeNotes.some((label) => notas.includes(label));
};

const isFatherType = (tipo: string) => fatherTypes.has(cleanTipo(tipo));
const isMotherType = (tipo: string) => motherTypes.has(cleanTipo(tipo));
const isParentType = (tipo: string) => isFatherType(tipo) || isMotherType(tipo);
const isChildType = (tipo: string) => childTypes.has(cleanTipo(tipo));
const isSiblingType = (tipo: string) => siblingTypes.has(cleanTipo(tipo));

export function padresDe(pid: string, rels: RelRow[], byId: Map<string, PersonaLite>) {
  const fatherIds = new Set<string>();
  const motherIds = new Set<string>();
  for (const r of rels) {
    if (r.persona_id === pid && isFatherType(r.tipo)) fatherIds.add(r.pariente_id);
    if (r.persona_id === pid && isMotherType(r.tipo)) motherIds.add(r.pariente_id);
    if (r.pariente_id === pid && isChildType(r.tipo)) {
      const p = byId.get(r.persona_id);
      if (sexOf(p) === "femenino") motherIds.add(r.persona_id);
      else fatherIds.add(r.persona_id);
    }
  }
  const ids = new Set([...fatherIds, ...motherIds]);
  const list = [...ids].map((i) => byId.get(i)).filter(Boolean) as PersonaLite[];
  let padre = [...fatherIds].map((i) => byId.get(i)).find(Boolean) ?? list.find((p) => sexOf(p) === "masculino") ?? list.find((p) => sexOf(p) !== "femenino");
  let madre = [...motherIds].map((i) => byId.get(i)).find(Boolean) ?? list.find((p) => sexOf(p) === "femenino") ?? list.find((p) => p !== padre);

  // Visual/inference fallback: GEDCOM imports often preserve spouses but miss
  // the direct mother/father edge for children. If one parent exists, show that
  // parent's spouse as the likely missing parent in tree/profile views.
  const spouseIdsFor = (personId?: string) => {
    if (!personId) return [] as string[];
    const ids = new Set<string>();
    for (const r of rels) {
      if (!isSpouseLikeRelation(r)) continue;
      if (r.persona_id === personId) ids.add(r.pariente_id);
      if (r.pariente_id === personId) ids.add(r.persona_id);
    }
    return [...ids];
  };
  if (!madre && padre) {
    madre = spouseIdsFor(padre.id).map((id) => byId.get(id)).find((p) => sexOf(p) === "femenino");
  }
  if (!padre && madre) {
    padre = spouseIdsFor(madre.id).map((id) => byId.get(id)).find((p) => sexOf(p) === "masculino");
  }

  const all = new Map(list.map((p) => [p.id, p]));
  if (padre) all.set(padre.id, padre);
  if (madre) all.set(madre.id, madre);
  return { padre, madre, all: [...all.values()].sort(sortByBirth) };
}

export function conyugesDe(pid: string, rels: RelRow[], byId: Map<string, PersonaLite>) {
  const ids = new Set<string>();
  for (const r of rels) {
    if (!isSpouseLikeRelation(r)) continue;
    if (r.persona_id === pid) ids.add(r.pariente_id);
    if (r.pariente_id === pid) ids.add(r.persona_id);
  }
  // Visual: si dos personas comparten hijos, mostrarlas juntas aunque no exista relación de cónyuge.
  for (const hijo of hijosDe(pid, rels, byId)) {
    for (const parent of padresDe(hijo.id, rels, byId).all) if (parent.id !== pid) ids.add(parent.id);
  }
  return [...ids].map((i) => byId.get(i)).filter(Boolean).sort(sortByBirth) as PersonaLite[];
}

export function hijosDe(pid: string, rels: RelRow[], byId: Map<string, PersonaLite>) {
  const ids = new Set<string>();
  for (const r of rels) {
    if (r.pariente_id === pid && isParentType(r.tipo)) ids.add(r.persona_id);
    if (r.persona_id === pid && isChildType(r.tipo)) ids.add(r.pariente_id);
  }
  return [...ids].map((i) => byId.get(i)).filter(Boolean).sort(sortByBirth) as PersonaLite[];
}

export function hermanosDe(pid: string, rels: RelRow[], byId: Map<string, PersonaLite>) {
  const ids = new Set<string>();
  for (const r of rels) {
    if (!isSiblingType(r.tipo)) continue;
    if (r.persona_id === pid) ids.add(r.pariente_id);
    if (r.pariente_id === pid) ids.add(r.persona_id);
  }
  // also infer: share at least one parent
  const padres = padresDe(pid, rels, byId).all.map((p) => p.id);
  if (padres.length) {
    for (const r of rels) {
      if (isParentType(r.tipo) && padres.includes(r.pariente_id) && r.persona_id !== pid) {
        ids.add(r.persona_id);
      }
    }
  }
  return [...ids].map((i) => byId.get(i)).filter(Boolean).sort(sortByBirth) as PersonaLite[];
}

/** Find all relation rows linking two specific people (both directions). */
export function relacionesEntre(aId: string, bId: string, rels: RelRow[]) {
  return rels.filter(
    (r) => (r.persona_id === aId && r.pariente_id === bId) || (r.persona_id === bId && r.pariente_id === aId),
  );
}
