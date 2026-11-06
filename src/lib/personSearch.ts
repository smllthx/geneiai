import { lifeDates, birthSortYear } from "@/lib/personDates";
import { matchesCode, personaCode } from "@/lib/personaCode";
import { norm, fuzzyScore } from "@/lib/search/fuzzy";

export type SearchablePerson = {
  id: string;
  nombres?: string | null;
  foto_url?: string | null;
  apellidos?: string | null;
  codigo?: string | null;
  variantes_nombre?: string[] | null;
  sexo?: string | null;
  nacionalidad?: string | null;
  lugar?: string | null;
  nac_lugar?: string | null;
  defuncion_lugar?: string | null;
  nac_fecha?: string | null;
  nac_fecha_aprox?: string | null;
  nac_rango_ini?: number | null;
  nac_rango_fin?: number | null;
  defuncion_fecha?: string | null;
  viva?: string | null;
  notas?: string | null;
};

export function personSearchText(person: SearchablePerson) {
  return [
    person.nombres,
    person.apellidos,
    ...(Array.isArray(person.variantes_nombre) ? person.variantes_nombre : []),
    person.codigo,
    person.sexo,
    person.nacionalidad,
    person.lugar,
    person.nac_lugar,
    person.defuncion_lugar,
    person.nac_fecha,
    person.nac_fecha_aprox,
    person.nac_rango_ini,
    person.nac_rango_fin,
    person.defuncion_fecha,
    personaCode(person.id),
    person.id,
  ]
    .filter((x) => x !== null && x !== undefined && String(x).trim())
    .join(" ");
}

export function personFullName(person: SearchablePerson) {
  return [person.nombres, person.apellidos].filter(Boolean).join(" ").trim() || "Persona sin nombre";
}

export function personIndexKey(person: SearchablePerson) {
  const surname = String(person.apellidos ?? "").trim();
  const names = String(person.nombres ?? "").trim();
  return `${surname || names} ${surname ? names : ""} ${birthSortYear(person) ?? ""}`.trim();
}

export function personIndexLetter(person: SearchablePerson) {
  const key = norm(person.apellidos || person.nombres || "#");
  const first = key.charAt(0).toUpperCase();
  return /[A-Z0-9]/.test(first) ? first : "#";
}

export function comparePeopleAlphabetically(a: SearchablePerson, b: SearchablePerson) {
  const ak = personIndexKey(a);
  const bk = personIndexKey(b);
  return ak.localeCompare(bk, "es", { sensitivity: "base", numeric: true });
}

export function personSearchSubtitle(person: SearchablePerson) {
  const life = lifeDates(person) || "Fechas sin registrar";
  const code = person.codigo || personaCode(person.id);
  return `${life} · ${code}`;
}

export function filterPeopleForQuery<T extends SearchablePerson>(
  people: T[],
  query: string,
  options: { excludeId?: string | null; limit?: number } = {},
) {
  const q = query.trim();
  const limit = options.limit ?? 30;
  const pool = people.filter((p) => p.id !== options.excludeId);

  if (!q) {
    return pool
      .slice()
      .sort(comparePeopleAlphabetically)
      .slice(0, limit);
  }

  return pool.map(item => ({ item, score: personQueryScore(item, q) }))
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || comparePeopleAlphabetically(a.item, b.item))
    .slice(0, limit).map(result => result.item);
}

/** Name relevance is retained by every person picker; missing tokens are not matches. */
export function personQueryScore(person: SearchablePerson, query: string): number {
  const q = norm(query);
  if (!q) return 0;
  if (matchesCode(query, person.id) || (person.codigo && norm(person.codigo) === q)) return 20;
  const name = norm(personFullName(person));
  const aliases = (person.variantes_nombre ?? []).flatMap(alias => {
    const value = norm(alias);
    return [value, norm(`${alias} ${person.apellidos || ""}`)];
  }).filter(Boolean);
  if (name === q) return 10;
  if (aliases.includes(q)) return 9;
  if (name.startsWith(q)) return 8;
  const tokens = q.split(" ");
  const scores = [name, ...aliases].map(form => {
    const individual = tokens.map(token => fuzzyScore(token, form));
    return individual.every(score => score >= .7)
      ? individual.reduce((a, b) => a + b, 0) / individual.length * 5 : 0;
  });
  const best = Math.max(0, ...scores);
  if (best) return best;
  // Dates, origin and code are searchable without overpowering an exact name.
  return norm(personSearchText(person)).includes(q) ? 2 : 0;
}
