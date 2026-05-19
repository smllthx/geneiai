// Tree coherence checker — detects common genealogical inconsistencies
// (cycles, sex mismatches, impossible birth ranges, parent/child age gaps, duplicate spouses).
// Runs entirely client-side from the already-loaded data — fast, no extra fetches.

import type { RelRow } from "@/lib/kinship";

export type Persona = {
  id: string;
  nombres: string;
  apellidos: string;
  sexo?: string | null;
  nac_fecha?: string | null;
  nac_rango_ini?: number | null;
  defuncion_fecha?: string | null;
};

export type Issue = {
  id: string;            // stable hash for dedupe
  severity: "error" | "warn" | "info";
  persona_id: string;
  related_id?: string;
  message: string;
  rule: string;
};

const year = (p?: Persona) => {
  if (!p) return null;
  if (p.nac_fecha) return new Date(p.nac_fecha).getUTCFullYear();
  return p.nac_rango_ini ?? null;
};
const deathYear = (p?: Persona) =>
  p?.defuncion_fecha ? new Date(p.defuncion_fecha).getUTCFullYear() : null;

export function checkCoherence(personas: Persona[], rels: RelRow[]): Issue[] {
  const byId = new Map(personas.map((p) => [p.id, p]));
  const issues: Issue[] = [];
  const push = (i: Omit<Issue, "id">) =>
    issues.push({ ...i, id: `${i.rule}:${i.persona_id}:${i.related_id ?? ""}` });

  // Padres por hijo
  const padresPorHijo = new Map<string, string[]>();
  for (const r of rels) {
    if (r.tipo === "padre" || r.tipo === "madre") {
      const arr = padresPorHijo.get(r.persona_id) ?? [];
      arr.push(r.pariente_id);
      padresPorHijo.set(r.persona_id, arr);
    }
  }

  // 1) sexo de padres
  for (const [hijo, padresIds] of padresPorHijo) {
    const padres = padresIds.map((i) => byId.get(i)).filter(Boolean) as Persona[];
    const masc = padres.filter((p) => p.sexo === "masculino").length;
    const fem = padres.filter((p) => p.sexo === "femenino").length;
    if (masc > 1)
      push({ severity: "warn", persona_id: hijo, message: "Más de un padre masculino registrado.", rule: "padres_dup_masc" });
    if (fem > 1)
      push({ severity: "warn", persona_id: hijo, message: "Más de una madre femenina registrada.", rule: "padres_dup_fem" });
  }

  // 2) padre/hijo: padre debería ser >= ~14 años mayor
  for (const r of rels) {
    if (r.tipo !== "padre" && r.tipo !== "madre") continue;
    const hijo = byId.get(r.persona_id);
    const padre = byId.get(r.pariente_id);
    const yH = year(hijo);
    const yP = year(padre);
    if (yH && yP) {
      const diff = yH - yP;
      if (diff < 12)
        push({ severity: "error", persona_id: hijo!.id, related_id: padre!.id,
               message: `Padre/madre demasiado joven (${diff} años de diferencia).`, rule: "padre_joven" });
      if (diff > 70)
        push({ severity: "warn", persona_id: hijo!.id, related_id: padre!.id,
               message: `Padre/madre con más de 70 años al nacer (${diff} años).`, rule: "padre_muy_mayor" });
      const yD = deathYear(padre);
      if (yD && yD < yH - 1)
        push({ severity: "error", persona_id: hijo!.id, related_id: padre!.id,
               message: `Padre/madre falleció antes del nacimiento (${yD} < ${yH}).`, rule: "padre_fallecido_antes" });
    }
  }

  // 3) cónyuges duplicados con sexo idéntico (sin etiqueta)
  for (const r of rels) {
    if (r.tipo !== "conyuge") continue;
    const a = byId.get(r.persona_id), b = byId.get(r.pariente_id);
    if (a && b && a.sexo && b.sexo && a.sexo === b.sexo) {
      push({ severity: "info", persona_id: a.id, related_id: b.id,
             message: "Cónyuges del mismo sexo — verifica que sea intencional.", rule: "conyuges_mismo_sexo" });
    }
  }

  // 4) ciclos en la línea ancestral
  const adj = new Map<string, string[]>(); // hijo -> padres
  for (const r of rels) if (r.tipo === "padre" || r.tipo === "madre") {
    const arr = adj.get(r.persona_id) ?? []; arr.push(r.pariente_id); adj.set(r.persona_id, arr);
  }
  for (const start of personas) {
    const seen = new Set<string>([start.id]);
    const stack = [...(adj.get(start.id) ?? [])];
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === start.id) {
        push({ severity: "error", persona_id: start.id, message: "Ciclo detectado en la línea ancestral.", rule: "ciclo_ancestral" });
        break;
      }
      if (seen.has(cur)) continue;
      seen.add(cur);
      stack.push(...(adj.get(cur) ?? []));
    }
  }

  // dedupe por id
  const out = new Map<string, Issue>();
  for (const i of issues) out.set(i.id, i);
  return [...out.values()];
}
