// Tree coherence checker — detects common genealogical inconsistencies
// (cycles, self-links, repeated parental links and impossible parent/child dates).
// Runs entirely client-side from the already-loaded data — fast, no extra fetches.

import type { RelRow } from "@/lib/kinship";

export type Persona = {
  id: string;
  nombres: string;
  apellidos: string;
  sexo?: string | null;
  nac_fecha?: string | null;
  nac_rango_ini?: number | null;
  nac_rango_fin?: number | null;
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

function birthBounds(p?: Persona) {
  const exact = p?.nac_fecha?.match(/^(\d{4})(?:-|$)/)?.[1];
  if (exact) return { min: Number(exact), max: Number(exact) };
  return { min: p?.nac_rango_ini ?? null, max: p?.nac_rango_fin ?? null };
}

export function checkCoherence(personas: Persona[], rels: RelRow[]): Issue[] {
  const byId = new Map(personas.map((p) => [p.id, p]));
  const issues: Issue[] = [];
  const push = (i: Omit<Issue, "id">) =>
    issues.push({ ...i, id: `${i.rule}:${i.persona_id}:${i.related_id ?? ""}` });

  const seenParents = new Set<string>();
  for (const r of rels) {
    if (r.tipo !== "padre" && r.tipo !== "madre") continue;
    const child = byId.get(r.persona_id), parent = byId.get(r.pariente_id);
    if (!child || !parent) continue;
    const key = `${child.id}:${parent.id}:${r.tipo}`;
    if (seenParents.has(key)) push({ severity: "warn", persona_id: child.id, related_id: parent.id,
      message: "El mismo vínculo parental aparece más de una vez.", rule: "vinculo_repetido" });
    seenParents.add(key);

    const childBirth = birthBounds(child), parentBirth = birthBounds(parent);
    if (childBirth.max !== null && parentBirth.min !== null && childBirth.max - parentBirth.min < 12)
      push({ severity: "error", persona_id: child.id, related_id: parent.id,
        message: "Las fechas registradas dejan menos de 12 años entre ambos nacimientos.", rule: "padre_joven" });
    if (childBirth.min !== null && parentBirth.max !== null && childBirth.min - parentBirth.max > 70)
      push({ severity: "warn", persona_id: child.id, related_id: parent.id,
        message: "Las fechas registradas dejan más de 70 años entre ambos nacimientos.", rule: "padre_muy_mayor" });
    const died = parent.defuncion_fecha?.match(/^(\d{4})(?:-|$)/)?.[1];
    if (died && childBirth.min !== null && Number(died) < childBirth.min - 1)
      push({ severity: "error", persona_id: child.id, related_id: parent.id,
        message: "La defunción del progenitor precede en más de un año al nacimiento registrado.", rule: "padre_fallecido_antes" });
  }

  for (const r of rels) {
    if (r.persona_id === r.pariente_id)
      push({ severity: "error", persona_id: r.persona_id, message: "La persona está vinculada consigo misma.", rule: "autorrelacion" });
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
