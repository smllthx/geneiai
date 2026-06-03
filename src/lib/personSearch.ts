import { matchesCode, personaCode } from "@/lib/personaCode";
import { norm, rankResults } from "@/lib/search/fuzzy";

export type SearchablePerson = {
  id: string;
  nombres?: string | null;
  apellidos?: string | null;
  variantes_nombre?: string[] | null;
  sexo?: string | null;
  nac_fecha?: string | null;
  nac_fecha_aprox?: string | null;
  nac_rango_ini?: number | null;
  nac_rango_fin?: number | null;
  defuncion_fecha?: string | null;
  defuncion_fecha_aprox?: string | null;
  def_rango_ini?: number | null;
  def_rango_fin?: number | null;
  notas?: string | null;
};

export function personSearchText(person: SearchablePerson) {
  return [
    person.nombres,
    person.apellidos,
    ...(Array.isArray(person.variantes_nombre) ? person.variantes_nombre : []),
    person.sexo,
    person.nac_fecha,
    person.nac_fecha_aprox,
    person.nac_rango_ini,
    person.nac_rango_fin,
    person.defuncion_fecha,
    person.defuncion_fecha_aprox,
    person.def_rango_ini,
    person.def_rango_fin,
    personaCode(person.id),
    person.id,
  ]
    .filter((x) => x !== null && x !== undefined && String(x).trim())
    .join(" ");
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
      .sort((a, b) => `${a.apellidos ?? ""} ${a.nombres ?? ""}`.localeCompare(`${b.apellidos ?? ""} ${b.nombres ?? ""}`))
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
      return `${a.item.apellidos ?? ""} ${a.item.nombres ?? ""}`.localeCompare(`${b.item.apellidos ?? ""} ${b.item.nombres ?? ""}`);
    })
    .slice(0, limit)
    .map((r) => r.item);
}
