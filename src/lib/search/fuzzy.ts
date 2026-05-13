// Fuzzy matcher for universal search.
// Handles: accents, case, common typos, name translations & spelling variants.

export const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export const norm = (s: string | null | undefined) =>
  stripAccents(String(s ?? "")).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

// Damerau-Levenshtein
export function dlDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const c = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
      d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[m][n];
}

// Diccionario de equivalencias y traducciones (multi-lengua, foco IT/ES/DE/FR/EN)
const EQUIV_BASE: Record<string, string[]> = {
  // Hombres
  juan: ["giovanni", "john", "johann", "jean", "joao", "joan", "ivan", "jan", "hans"],
  pedro: ["pietro", "peter", "pierre", "pyotr", "petrus"],
  jose: ["giuseppe", "joseph", "josef", "joseba", "iosep"],
  santiago: ["jacobo", "jaime", "james", "giacomo", "jacques", "jakob", "diego", "iago"],
  francisco: ["francesco", "francis", "franz", "francois", "frantisek", "pancho", "paco"],
  miguel: ["michele", "michael", "michel", "mihail", "michail"],
  carlos: ["carlo", "charles", "karl", "carolus", "karol"],
  antonio: ["anton", "antoine", "anthony", "antonios", "tony"],
  manuel: ["emanuele", "emmanuel", "manoel", "manolo"],
  luis: ["luigi", "louis", "ludwig", "ludovico", "lewis"],
  pablo: ["paolo", "paul", "pavel", "pawel"],
  jorge: ["giorgio", "george", "georg", "georges", "jurgen"],
  andres: ["andrea", "andrew", "andreas", "andre"],
  esteban: ["stefano", "stephen", "stefan", "etienne"],
  enrique: ["enrico", "henry", "heinrich", "henri"],
  guillermo: ["guglielmo", "william", "wilhelm", "guillaume"],
  alfredo: ["alfred", "alfredo"],
  ricardo: ["riccardo", "richard"],
  felipe: ["filippo", "philip", "philipp", "philippe"],
  fernando: ["ferdinando", "ferdinand"],
  domingo: ["domenico", "dominic", "dominik", "dominique"],
  // Mujeres
  maria: ["mary", "marie", "miryam", "miriam", "marija"],
  ana: ["anna", "anne", "anja", "annette", "hannah"],
  juana: ["giovanna", "jeanne", "joan", "jane", "johanna"],
  rosa: ["rosa", "rose"],
  catalina: ["caterina", "catherine", "katharina", "kate", "katie"],
  isabel: ["isabella", "elizabeth", "elisabeth", "elisabetta"],
  margarita: ["margherita", "margaret", "margarethe", "marguerite"],
  teresa: ["teresa", "therese", "theresa"],
  sofia: ["sophia", "sophie", "sofia"],
  elena: ["elena", "helen", "helena", "ellen"],
  lucia: ["lucia", "lucy", "lucie"],
  carmen: ["carmen", "carmela", "carmelina"],
  // Apellidos típicos liguros/suizos con variantes ortográficas
  sanguineti: ["sanguinetti", "sanguinetty", "sanguinety", "sangineti"],
  aeschlimann: ["aeschliman", "eschlimann", "eschliman", "aschlimann"],
};

// Index inverso: cualquier variante apunta al canónico
const VAR_INDEX: Map<string, string> = new Map();
for (const [base, vars] of Object.entries(EQUIV_BASE)) {
  VAR_INDEX.set(base, base);
  for (const v of vars) VAR_INDEX.set(v, base);
}

export function expandTerm(term: string): string[] {
  const n = norm(term);
  if (!n) return [];
  const expanded = new Set<string>([n]);
  // Variantes conocidas
  const canonical = VAR_INDEX.get(n);
  if (canonical) {
    expanded.add(canonical);
    for (const v of EQUIV_BASE[canonical] ?? []) expanded.add(v);
  }
  // Errores ortográficos comunes (consonantes dobles, h muda, ph→f, k→c)
  expanded.add(n.replace(/(.)\1+/g, "$1"));            // colapsa repetidas
  expanded.add(n.replace(/h/g, ""));
  expanded.add(n.replace(/ph/g, "f").replace(/k/g, "c").replace(/y/g, "i"));
  expanded.add(n.replace(/v/g, "b").replace(/z/g, "s"));
  return [...expanded].filter(Boolean);
}

// Score 0..1 — 1 = match exacto/equivalencia conocida, 0 = nada que ver
export function fuzzyScore(query: string, candidate: string): number {
  const q = norm(query);
  const c = norm(candidate);
  if (!q || !c) return 0;
  if (c.includes(q) || q.includes(c)) return 1;
  // Comparar por tokens
  const qToks = q.split(" ");
  const cToks = c.split(" ");
  let best = 0;
  for (const qt of qToks) {
    const expansions = expandTerm(qt);
    for (const e of expansions) {
      for (const ct of cToks) {
        if (ct === e) { best = Math.max(best, 1); continue; }
        if (ct.startsWith(e) || e.startsWith(ct)) { best = Math.max(best, 0.9); continue; }
        const dist = dlDistance(e, ct);
        const maxLen = Math.max(e.length, ct.length);
        if (maxLen >= 4) {
          const sim = 1 - dist / maxLen;
          if (sim >= 0.75) best = Math.max(best, sim);
        }
      }
    }
  }
  return best;
}

export function rankResults<T>(items: T[], query: string, getText: (x: T) => string): { item: T; score: number }[] {
  return items
    .map((item) => ({ item, score: fuzzyScore(query, getText(item)) }))
    .filter((r) => r.score >= 0.7)
    .sort((a, b) => b.score - a.score);
}
