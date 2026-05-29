// Unified kinship helpers — single source of truth for family relationships across
// the tree, the person detail view, and any other panel that needs to derive
// parents/children/spouses/siblings from the `relaciones` table.

import type { PersonaLite } from "@/components/PersonCard";

export type RelTipo = "padre" | "madre" | "hijo" | "conyuge" | "hermano";

export type RelRow = {
  id: string;
  persona_id: string;
  pariente_id: string;
  tipo: RelTipo | string;
  notas?: string | null;
};

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

const spouseLikeNotes = ["unión civil", "union civil", "conviviente", "convivencia", "cohabitante", "cohabitación", "cohabitacion"];

export const isSpouseLikeRelation = (r: Pick<RelRow, "tipo" | "notas">) => {
  if (r.tipo === "conyuge") return true;
  if (r.tipo !== "otro") return false;
  const notas = (r.notas ?? "").toLowerCase();
  return spouseLikeNotes.some((label) => notas.includes(label));
};

export function padresDe(pid: string, rels: RelRow[], byId: Map<string, PersonaLite>) {
  const fatherIds = new Set<string>();
  const motherIds = new Set<string>();
  for (const r of rels) {
    if (r.persona_id === pid && r.tipo === "padre") fatherIds.add(r.pariente_id);
    if (r.persona_id === pid && r.tipo === "madre") motherIds.add(r.pariente_id);
    if (r.pariente_id === pid && r.tipo === "hijo") {
      const p = byId.get(r.persona_id);
      if (p?.sexo === "femenino") motherIds.add(r.persona_id);
      else fatherIds.add(r.persona_id);
    }
  }
  const ids = new Set([...fatherIds, ...motherIds]);
  const list = [...ids].map((i) => byId.get(i)).filter(Boolean) as PersonaLite[];
  const padre = [...fatherIds].map((i) => byId.get(i)).find(Boolean) ?? list.find((p) => p.sexo === "masculino") ?? list.find((p) => p.sexo !== "femenino");
  const madre = [...motherIds].map((i) => byId.get(i)).find(Boolean) ?? list.find((p) => p.sexo === "femenino") ?? list.find((p) => p !== padre);
  return { padre, madre, all: list.sort(sortByBirth) };
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
    if (r.pariente_id === pid && (r.tipo === "padre" || r.tipo === "madre")) ids.add(r.persona_id);
    if (r.persona_id === pid && r.tipo === "hijo") ids.add(r.pariente_id);
  }
  return [...ids].map((i) => byId.get(i)).filter(Boolean).sort(sortByBirth) as PersonaLite[];
}

export function hermanosDe(pid: string, rels: RelRow[], byId: Map<string, PersonaLite>) {
  const ids = new Set<string>();
  for (const r of rels) {
    if (r.tipo !== "hermano") continue;
    if (r.persona_id === pid) ids.add(r.pariente_id);
    if (r.pariente_id === pid) ids.add(r.persona_id);
  }
  // also infer: share at least one parent
  const padres = padresDe(pid, rels, byId).all.map((p) => p.id);
  if (padres.length) {
    for (const r of rels) {
      if ((r.tipo === "padre" || r.tipo === "madre") && padres.includes(r.pariente_id) && r.persona_id !== pid) {
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
