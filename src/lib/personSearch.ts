import { matchesCode, personaCode } from "@/lib/personaCode";
import { norm, rankResults } from "@/lib/search/fuzzy";

export type SearchablePerson = {
  id: string;
  nombres?: string | null;
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
  defuncion_fecha_aprox?: string | null;
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
    person.defuncion_fecha_aprox,
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
  return `${surname || names} ${surname ? names : ""} ${person.nac_fecha ?? person.nac_rango_ini ?? ""}`.trim();
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
  const born = person.nac_fecha ?? person.nac_fecha_aprox ?? person.nac_rango_ini;
  const died = person.defuncion_fecha ?? person.defuncion_fecha_aprox;
  const life = born || died ? `${born ?? "?"}–${died ?? ""}` : "Fechas sin registrar";
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

  const qNorm = norm(q);
  const exact = pool
    .filter((p) => matchesCode(q, p.id) || personSearchText(p).toLowerCase().includes(q.toLowerCase()) || norm(personSearchText(p)).includes(qNorm))
    .map((item) => ({ item, score: matchesCode(q, item.id) ? 2 : 1.15 }));
  const fuzzy = rankResults(pool, q, personSearchText);
  const byId = new Map<string, { item: T; score: number }>();

  [...exact, ...fuzzy].forEach((result) => {
    const current = byId.get(result.item.id);
    if (!current || result.score > current.score) byId.set(result.item.id, result);
  });

  return [...byId.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return comparePeopleAlphabetically(a.item, b.item);
    })
    .slice(0, limit)
    .map((r) => r.item);
}
