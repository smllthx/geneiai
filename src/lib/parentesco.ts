// Calcula el parentesco entre dos personas usando BFS por padres,
// luego clasifica el patrón ascendientes/descendientes a un nombre
// común en español (padre, abuelo, tío, primo segundo, sobrino nieto…).

export type RelRow = { persona_id: string; pariente_id: string; tipo: string };
export type PersonaLite = { id: string; sexo?: string | null; nombres?: string; apellidos?: string };

type Step = { id: string; dist: number; via: "padre" | "conyuge" };

/** Devuelve mapa id→distancia (en saltos padre/madre) desde `from`. */
function ancestralMap(from: string, rels: RelRow[]): Map<string, number> {
  // Padres de X = filas (persona_id=X, tipo=padre|madre) o (pariente_id=X, tipo=hijo)
  const parentsOf = new Map<string, string[]>();
  for (const r of rels) {
    if ((r.tipo === "padre" || r.tipo === "madre") && r.persona_id && r.pariente_id) {
      const arr = parentsOf.get(r.persona_id) ?? [];
      arr.push(r.pariente_id);
      parentsOf.set(r.persona_id, arr);
    }
    if (r.tipo === "hijo" && r.persona_id && r.pariente_id) {
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
    if (r.tipo !== "conyuge") continue;
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
  return null;
}
