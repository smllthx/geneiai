// Generador de búsquedas externas (sin scraping). Sólo construye queries y URLs.
import type { Tables } from "@/integrations/supabase/types";
type P = Tables<"personas">;

export interface ExternalSearch {
  plataforma: string;
  objetivo: string;
  query: string;
  url: string;
}

const enc = encodeURIComponent;
const yearOf = (d: string | null): number | null => (d ? new Date(d).getUTCFullYear() : null);

export function generateExternalSearches(p: P): ExternalSearch[] {
  const out: ExternalSearch[] = [];
  const nombres = p.nombres ?? "";
  const apellidos = p.apellidos ?? "";
  const nac = yearOf(p.nac_fecha) ?? p.nac_rango_ini ?? null;
  const def = yearOf(p.defuncion_fecha) ?? null;
  const apellido1 = apellidos.split(/\s+/)[0] ?? "";

  // FamilySearch Tree
  out.push({
    plataforma: "FamilySearch — Tree",
    objetivo: `Buscar a ${nombres} ${apellidos} en el árbol`,
    query: `${nombres} ${apellidos}`,
    url: `https://www.familysearch.org/search/tree/results?q.givenName=${enc(nombres)}&q.surname=${enc(apellidos)}${nac ? `&q.birthLikePlace.from=&q.birthLikeDate.from=${nac - 5}&q.birthLikeDate.to=${nac + 5}` : ""}`,
  });
  // FamilySearch Records
  out.push({
    plataforma: "FamilySearch — Records",
    objetivo: "Buscar registros documentales",
    query: `${nombres} ${apellidos}`,
    url: `https://www.familysearch.org/search/record/results?q.givenName=${enc(nombres)}&q.surname=${enc(apellidos)}${nac ? `&q.birthLikeDate.from=${nac - 5}&q.birthLikeDate.to=${nac + 5}` : ""}`,
  });
  // MyHeritage
  out.push({
    plataforma: "MyHeritage — SuperSearch",
    objetivo: "Búsqueda preparada en MyHeritage",
    query: `${nombres} ${apellidos}`,
    url: `https://www.myheritage.es/research?formId=master&formMode=&qname=Name+fnmo.${enc(nombres)}+lnmo.${enc(apellidos)}${nac ? `&qevents-event/-/start=Event+et.birth+ed.${nac}+ev.5` : ""}`,
  });
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
      url: `https://www.familysearch.org/search/record/results?q.givenName=${enc(nombres)}&q.surname=${enc(alt)}`,
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
