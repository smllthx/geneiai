// Generador de búsquedas externas (sin scraping). Sólo construye queries y URLs.
import { buildResearchLinks } from "@/lib/researchSearch";
import type { Tables } from "@/integrations/supabase/types";
type P = Tables<"personas">;

export interface ExternalSearch {
  plataforma: string;
  objetivo: string;
  query: string;
  url: string;
}

const enc = encodeURIComponent;
const yearOf = (d: string | null): number | null => { const year = d ? new Date(d).getUTCFullYear() : NaN; return Number.isFinite(year) ? year : null; };

export function generateExternalSearches(p: P, place?: string): ExternalSearch[] {
  const out: ExternalSearch[] = [];
  const nombres = p.nombres ?? "";
  const apellidos = p.apellidos ?? "";
  const nac = yearOf(p.nac_fecha) ?? p.nac_rango_ini ?? null;
  const def = yearOf(p.defuncion_fecha) ?? null;
  const apellido1 = apellidos.split(/\s+/)[0] ?? "";

  const criteria = { givenName: nombres, surname: apellidos, place, year: nac ? String(nac) : undefined };
  out.push(...buildResearchLinks(criteria).map(link => ({ plataforma: link.label, objetivo: link.description, query: [nombres, apellidos, place, nac].filter(Boolean).join(" "), url: link.url })));
  // Google general
  const gQuery = `"${nombres} ${apellido1}"${nac ? ` ${nac - 5}..${nac + 5}` : ""} genealogía`;
  out.push({
    plataforma: "Google",
    objetivo: "Búsqueda general con operadores",
    query: gQuery,
    url: `https://www.google.com/search?q=${enc(gQuery)}`,
  });
  // Google Books
  out.push({
    plataforma: "Google Books",
    objetivo: "Mención en libros y prensa histórica",
    query: `"${nombres} ${apellido1}"`,
    url: `https://www.google.com/search?tbm=bks&q=${enc(`"${nombres} ${apellido1}"`)}`,
  });
  // Variantes sólo para apellido (ejemplos comunes)
  const variantes: Record<string, string[]> = {
    sanguineti: ["Sanguinetti", "Sanguinetto"],
    aeschlimann: ["Aeschliman", "Eschlimann"],
    queirolo: ["Queyrolo", "Quirolo", "Cairolo"],
  };
  const v = variantes[apellido1.toLowerCase()];
  if (v) for (const alt of v) {
    out.push({
      plataforma: `FamilySearch — variante "${alt}"`,
      objetivo: `Probar variante ortográfica del apellido`,
      query: `${nombres} ${alt}`,
      url: buildResearchLinks({ ...criteria, surname: alt }).find(link => link.id === "fs-records")!.url,
    });
  }
  if (def) {
    out.push({
      plataforma: "Google — defunción",
      objetivo: "Buscar defunción / esquela / cementerio",
      query: `"${nombres} ${apellido1}" defunción ${def - 10}..${def + 10}`,
      url: `https://www.google.com/search?q=${enc(`"${nombres} ${apellido1}" defunción ${def - 10}..${def + 10}`)}`,
    });
  }
  return out;
}
