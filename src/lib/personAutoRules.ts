type PlaceLike = {
  pais?: string | null;
  region?: string | null;
  provincia?: string | null;
  ciudad?: string | null;
};

type PersonLike = {
  id: string;
  nombres?: string | null;
  apellidos?: string | null;
  sexo?: string | null;
  nac_fecha?: string | null;
  nac_rango_ini?: number | null;
  nacionalidad?: string | null;
  viva?: string | null;
};

const MALE_NAMES = new Set([
  "aaron", "alberto", "alejandro", "alfonso", "alonso", "andres", "antonio", "benjamin", "carlos",
  "cesar", "cristian", "cristobal", "daniel", "diego", "domingo", "eduardo", "enrique", "erick",
  "ernesto", "felipe", "fernando", "francisco", "gabriel", "guillermo", "hernan", "ignacio",
  "jaime", "javier", "jose", "juan", "julio", "luis", "manuel", "marcelo", "marcos", "martin",
  "matias", "miguel", "nicolas", "oscar", "pablo", "patricio", "pedro", "rafael", "ramon",
  "ricardo", "roberto", "rodrigo", "rolf", "sebastian", "sergio", "vicente", "victor",
]);

const FEMALE_NAMES = new Set([
  "adriana", "alejandra", "ana", "andrea", "angela", "antonia", "beatriz", "camila", "carla",
  "carmen", "catalina", "cecilia", "claudia", "constanza", "daniela", "elena", "elisa", "emilia",
  "eugenia", "fabiola", "fernanda", "francisca", "gabriela", "graciela", "isabel", "josefa",
  "juana", "laura", "lucia", "luisa", "marcela", "margarita", "maria", "maritza", "monica",
  "natalia", "patricia", "paula", "raquel", "rosa", "sofia", "teresa", "valentina", "violeta",
]);

const COUNTRY_NATIONALITY: Record<string, string> = {
  argentina: "Argentina",
  chile: "Chile",
  suiza: "Suiza",
  switzerland: "Suiza",
  italia: "Italia",
  italy: "Italia",
  espana: "España",
  spain: "España",
  francia: "Francia",
  france: "Francia",
  alemania: "Alemania",
  germany: "Alemania",
  peru: "Perú",
  uruguay: "Uruguay",
  brasil: "Brasil",
  brazil: "Brasil",
  bolivia: "Bolivia",
  colombia: "Colombia",
  venezuela: "Venezuela",
  mexico: "México",
  "estados unidos": "Estados Unidos",
  usa: "Estados Unidos",
};

export const normalizeText = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const inferSexFromName = (names?: string | null): "masculino" | "femenino" | null => {
  const first = normalizeText(names).split(" ").find(Boolean);
  if (!first) return null;
  if (MALE_NAMES.has(first)) return "masculino";
  if (FEMALE_NAMES.has(first)) return "femenino";
  if (first.endsWith("a") && !first.endsWith("ia")) return "femenino";
  if (first.endsWith("o")) return "masculino";
  return null;
};

export const inferNationalityFromPlace = (place?: PlaceLike | null): string | null => {
  const parts = [place?.pais, place?.region, place?.provincia, place?.ciudad].map(normalizeText).filter(Boolean);
  for (const part of parts) {
    for (const [country, nationality] of Object.entries(COUNTRY_NATIONALITY)) {
      if (part === country || part.includes(country)) return nationality;
    }
  }
  return null;
};

export const inferLivingStatus = (birthDate?: string | null, birthRangeStart?: number | null): "no" | null => {
  const yearFromDate = birthDate ? Number(String(birthDate).match(/\d{4}/)?.[0]) : null;
  const birthYear = Number.isFinite(yearFromDate) && yearFromDate ? yearFromDate : birthRangeStart ?? null;
  const currentYear = new Date().getFullYear();
  return birthYear && currentYear - birthYear > 100 ? "no" : null;
};

export type RelationshipSuggestion = {
  personA: PersonLike;
  personB: PersonLike;
  sharedSurname: string;
  confidence: number;
  reason: string;
};

const firstSurname = (person: PersonLike) => normalizeText(person.apellidos).split(" ").find(Boolean) ?? "";
const birthYear = (person: PersonLike) => {
  const fromDate = person.nac_fecha ? Number(String(person.nac_fecha).match(/\d{4}/)?.[0]) : null;
  return Number.isFinite(fromDate) && fromDate ? fromDate : person.nac_rango_ini ?? null;
};

export const suggestSurnameRelationships = (people: PersonLike[], existingPairs = new Set<string>()) => {
  const suggestions: RelationshipSuggestion[] = [];
  for (let i = 0; i < people.length; i += 1) {
    for (let j = i + 1; j < people.length; j += 1) {
      const a = people[i];
      const b = people[j];
      const ap = firstSurname(a);
      if (!ap || ap.length < 3 || ap !== firstSurname(b)) continue;
      const pairKey = [a.id, b.id].sort().join(":");
      if (existingPairs.has(pairKey)) continue;
      const ay = birthYear(a);
      const by = birthYear(b);
      const diff = ay && by ? Math.abs(ay - by) : null;
      const confidence = diff == null ? 55 : diff <= 12 ? 78 : diff <= 35 ? 66 : 58;
      const relationHint = diff == null ? "posible grupo familiar" : diff <= 12 ? "posibles hermanos o primos cercanos" : "posible relación padre/madre-hijo o tío/sobrino";
      suggestions.push({
        personA: a,
        personB: b,
        sharedSurname: ap,
        confidence,
        reason: `Comparten el apellido ${ap}. Por fechas: ${relationHint}. Revisar antes de conectar.`,
      });
    }
  }
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 25);
};
