// Calcula el parentesco entre dos personas usando BFS por padres,
// luego clasifica el patrón ascendientes/descendientes a un nombre
// común en español (padre, abuelo, tío, primo segundo, sobrino nieto…).

export type RelRow = { persona_id: string; pariente_id: string; tipo: string };
export type PersonaLite = { id: string; sexo?: string | null; nombres?: string; apellidos?: string };

type Step = { id: string; dist: number; via: "padre" | "conyuge" };

const normalizeTipo = (value?: string | null) => (value ?? "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[\/_-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const parentTypes = new Set([
  "padre", "madre", "progenitor", "progenitora", "parent", "parentes", "padres",
  "padre adoptivo", "madre adoptiva", "padre biologico", "madre biologica",
  "padre de crianza", "madre de crianza", "tutor", "tutora", "father", "mother",
]);
const childTypes = new Set(["hijo", "hija", "child", "descendiente"]);
const spouseTypes = new Set([
  "conyuge", "conjuge", "esposo", "esposa", "pareja", "conviviente", "convivencia",
  "matrimonio", "matrimonio civil", "union", "union civil", "union libre", "pareja de hecho",
]);

const isParentType = (tipo?: string | null) => parentTypes.has(normalizeTipo(tipo));
const isChildType = (tipo?: string | null) => childTypes.has(normalizeTipo(tipo));
const isSpouseType = (tipo?: string | null) => spouseTypes.has(normalizeTipo(tipo));

/** Devuelve mapa id→distancia (en saltos padre/madre) desde `from`. */
function ancestralMap(from: string, rels: RelRow[]): Map<string, number> {
  // Padres de X = filas (persona_id=X, tipo=padre|madre) o (pariente_id=X, tipo=hijo)
  const parentsOf = new Map<string, string[]>();
  for (const r of rels) {
    // The canonical row is child(persona_id) -> parent(pariente_id). GEDCOM and
    // FamilySearch imports also use the inverse child label, so normalize both.
    if (isParentType(r.tipo) && r.persona_id && r.pariente_id) {
      const arr = parentsOf.get(r.persona_id) ?? [];
      arr.push(r.pariente_id);
      parentsOf.set(r.persona_id, arr);
    }
    if (isChildType(r.tipo) && r.persona_id && r.pariente_id) {
      const arr = parentsOf.get(r.pariente_id) ?? [];
      arr.push(r.persona_id);
      parentsOf.set(r.pariente_id, arr);
    }
  }
  const dist = new Map<string, number>();
  dist.set(from, 0);
  const q: string[] = [from];
  while (q.length) {
    const cur = q.shift()!;
    const d = dist.get(cur)!;
    for (const p of parentsOf.get(cur) ?? []) {
      if (!dist.has(p)) { dist.set(p, d + 1); q.push(p); }
    }
  }
  return dist;
}

function spouseOf(id: string, rels: RelRow[]): string[] {
  const out = new Set<string>();
  for (const r of rels) {
    if (!isSpouseType(r.tipo)) continue;
    if (r.persona_id === id) out.add(r.pariente_id);
    if (r.pariente_id === id) out.add(r.persona_id);
  }
  return [...out];
}

const F = (sexo?: string | null) => sexo === "femenino";
const ord = (n: number, fem: boolean) => {
  const list = fem
    ? ["primera", "segunda", "tercera", "cuarta", "quinta", "sexta", "séptima", "octava", "novena", "décima"]
    : ["primero", "segundo", "tercero", "cuarto", "quinto", "sexto", "séptimo", "octavo", "noveno", "décimo"];
  return list[n - 1] ?? `${n}º`;
};

function ascLabel(n: number, fem: boolean): string {
  // 1=padre, 2=abuelo, 3=bisabuelo, 4=tatarabuelo, 5+=N-bisabuelo
  const base = fem ? "abuela" : "abuelo";
  if (n === 1) return fem ? "madre" : "padre";
  if (n === 2) return base;
  if (n === 3) return fem ? "bisabuela" : "bisabuelo";
  if (n === 4) return fem ? "tatarabuela" : "tatarabuelo";
  return `${n - 2}-veces ${base}`;
}
function descLabel(n: number, fem: boolean): string {
  if (n === 1) return fem ? "hija" : "hijo";
  if (n === 2) return fem ? "nieta" : "nieto";
  if (n === 3) return fem ? "bisnieta" : "bisnieto";
  if (n === 4) return fem ? "tataranieta" : "tataranieto";
  return `${n - 2}-veces ${fem ? "nieta" : "nieto"}`;
}
function tioLabel(d: number, fem: boolean): string {
  // d = descenso del antepasado común al objetivo. d=2 → tío/a, d=3 → tío abuelo/a, d=4 → tío bisabuelo/a.
  const base = fem ? "tía" : "tío";
  if (d === 2) return base;
  const suf = ascLabel(d - 1, fem);
  return `${base} ${suf}`;
}
function sobLabel(a: number, fem: boolean): string {
  // a = ascenso de "yo" al antepasado común. a=2 → sobrino, a=3 → sobrino nieto.
  const base = fem ? "sobrina" : "sobrino";
  if (a === 2) return base;
  const suf = descLabel(a - 1, fem);
  return `${base} ${suf}`;
}

export type Parentesco = {
  texto: string;          // "tu primo segundo"
  via?: "conyuge";        // si el camino pasó por un cónyuge (político)
  pasos: number;          // saltos totales
};

/**
 * Returns the shortest explainable chain between two people. Unlike the
 * relationship label calculation, this keeps parent, child, spouse and
 * sibling edges, so the UI can show a useful path for cousins and in-laws too.
 */
export function construirCaminoParentesco(origenId: string, destinoId: string, rels: RelRow[]): string[] {
  if (!origenId || !destinoId) return [];
  if (origenId === destinoId) return [origenId];
  const graph = new Map<string, Set<string>>();
  const connect = (a: string, b: string) => {
    if (!a || !b) return;
    const as = graph.get(a) ?? new Set<string>(); as.add(b); graph.set(a, as);
    const bs = graph.get(b) ?? new Set<string>(); bs.add(a); graph.set(b, bs);
  };
  for (const r of rels) {
    if (!r.persona_id || !r.pariente_id) continue;
    // Unknown/"otro" rows are intentionally not used: a free-form note is
    // not enough evidence to connect two branches of a tree.
    if (isParentType(r.tipo) || isChildType(r.tipo) || isSpouseType(r.tipo) || normalizeTipo(r.tipo) === "hermano" || normalizeTipo(r.tipo) === "hermana" || normalizeTipo(r.tipo) === "sibling") {
      connect(r.persona_id, r.pariente_id);
    }
  }
  const previous = new Map<string, string | null>([[origenId, null]]);
  const queue = [origenId];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === destinoId) break;
    for (const next of graph.get(current) ?? []) {
      if (previous.has(next)) continue;
      previous.set(next, current);
      queue.push(next);
    }
  }
  if (!previous.has(destinoId)) return [];
  const path: string[] = [];
  let current: string | null = destinoId;
  while (current) { path.unshift(current); current = previous.get(current) ?? null; }
  return path;
}

export function calcularParentesco(
  yoId: string,
  destinoId: string,
  rels: RelRow[],
  personas: PersonaLite[],
): Parentesco | null {
  if (!yoId || !destinoId) return null;
  if (yoId === destinoId) return { texto: "tú mismo", pasos: 0 };

  const byId = new Map(personas.map((p) => [p.id, p]));
  const destino = byId.get(destinoId);
  const fem = F(destino?.sexo);

  const tryPair = (aId: string, bId: string): Parentesco | null => {
    const ascA = ancestralMap(aId, rels);
    const ascB = ancestralMap(bId, rels);
    let best: { common: string; a: number; d: number } | null = null;
    for (const [anc, da] of ascA) {
      const db = ascB.get(anc);
      if (db == null) continue;
      if (!best || (da + db) < (best.a + best.d)) best = { common: anc, a: da, d: db };
    }
    if (!best) return null;
    const { a, d } = best;
    if (a === 0 && d === 0) return { texto: "tú mismo", pasos: 0 };
    if (a === 0) return { texto: `tu ${descLabel(d, fem)}`, pasos: d };
    if (d === 0) return { texto: `tu ${ascLabel(a, fem)}`, pasos: a };
    if (a === 1 && d === 1) return { texto: fem ? "tu hermana" : "tu hermano", pasos: 2 };
    if (a === 1) return { texto: `tu ${tioLabel(d, fem)}`, pasos: a + d };
    if (d === 1) return { texto: `tu ${sobLabel(a, fem)}`, pasos: a + d };
    // primos
    const grado = Math.min(a, d) - 1;
    const removed = Math.abs(a - d);
    const primo = fem ? "prima" : "primo";
    let txt = `tu ${primo} ${ord(grado, fem)}`;
    if (removed > 0) txt += ` (${removed}º grado)`;
    return { texto: txt, pasos: a + d };
  };

  // 1) Camino directo consanguíneo
  const direct = tryPair(yoId, destinoId);
  if (direct) return direct;

  // 2) Por cónyuge del destino (parentesco político)
  for (const sp of spouseOf(destinoId, rels)) {
    const r = tryPair(yoId, sp);
    if (r) return { texto: `cónyuge de ${r.texto}`, via: "conyuge", pasos: r.pasos + 1 };
  }
  // 3) Cónyuge de "yo"
  for (const sp of spouseOf(yoId, rels)) {
    const r = tryPair(sp, destinoId);
    if (r) return { texto: `${r.texto} (de tu pareja)`, via: "conyuge", pasos: r.pasos + 1 };
  }
  // 4) Imports may contain an explicit sibling row without parent rows. Keep
  // the relationship useful instead of reporting that the people are unrelated.
  for (const row of rels) {
    const tipo = normalizeTipo(row.tipo);
    if (!["hermano", "hermana", "sibling"].includes(tipo)) continue;
    if (!((row.persona_id === yoId && row.pariente_id === destinoId) || (row.persona_id === destinoId && row.pariente_id === yoId))) continue;
    return { texto: fem ? "tu hermana" : "tu hermano", pasos: 1 };
  }
  // 5) Last-resort graph path for historical/inverse relation categories. The
  // path is intentionally labelled as familiar until documentary parents make
  // a more precise degree possible.
  const fallbackPath = construirCaminoParentesco(yoId, destinoId, rels);
  if (fallbackPath.length > 1) return { texto: "familiar (camino registrado)", pasos: fallbackPath.length - 1 };
  return null;
}
