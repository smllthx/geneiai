/** Public search links only: no remote results or access permissions are implied. */
export type CatalogField = 'keywords' | 'title' | 'author' | 'subject' | 'surname';
export type ResearchCriteria = {
  givenName?: string;
  surname?: string;
  place?: string;
  year?: string;
  keywords?: string;
  catalogField?: CatalogField;
};
export type ResearchLink = { id: string; label: string; description: string; url: string };
const fields: CatalogField[] = ['keywords', 'title', 'author', 'subject', 'surname'];
const paramKeys = { givenName: 'nombres', surname: 'apellidos', place: 'lugar', year: 'anio', keywords: 'palabras', catalogField: 'campo' } as const;

export function criteriaFromParams(params: URLSearchParams): ResearchCriteria {
  return {
    givenName: params.get('nombres') ?? '', surname: params.get('apellidos') ?? '',
    place: params.get('lugar') ?? '', year: params.get('anio') ?? '', keywords: params.get('palabras') ?? '',
    catalogField: fields.includes(params.get('campo') as CatalogField) ? params.get('campo') as CatalogField : 'keywords',
  };
}
export function criteriaToParams(criteria: ResearchCriteria, mode: string, query: string, current = new URLSearchParams()) {
  const params = new URLSearchParams(current);
  for (const [field, key] of Object.entries(paramKeys)) {
    const value = criteria[field as keyof ResearchCriteria];
    if (value?.trim()) params.set(key, value); else params.delete(key);
  }
  if (query.trim()) params.set('q', query); else params.delete('q');
  params.set('modo', mode);
  return params;
}
function withParams(base: string, values: Record<string, string | undefined>) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(values)) if (value?.trim()) url.searchParams.set(key, value.trim());
  return url.href;
}
const literal = (value: string | undefined) => value?.replace(/["\\\r\n]/g, ' ').replace(/\s+/g, ' ').trim() ?? '';
export function catalogUrl(criteria: ResearchCriteria) {
  const terms: string[] = [];
  if (literal(criteria.place)) terms.push(`+place:"${literal(criteria.place)}"`);
  const field = fields.includes(criteria.catalogField!) ? criteria.catalogField! : 'keywords';
  if (literal(criteria.keywords)) terms.push(`+${field}:"${literal(criteria.keywords)}"`);
  else if (literal(criteria.surname)) terms.push(`+surname:"${literal(criteria.surname)}"`);
  return withParams('https://www.familysearch.org/search/catalog/results', { count: '20', query: terms.join(' ') || undefined });
}
export function buildResearchLinks(criteria: ResearchCriteria, mode = 'registros'): ResearchLink[] {
  const c = Object.fromEntries(Object.entries(criteria).map(([k, v]) => [k, v?.trim()])) as ResearchCriteria;
  if (![c.givenName, c.surname, c.place, c.keywords].some(Boolean)) return [];
  const year = /^\d{3,4}$/.test(c.year ?? '') && Number(c.year) <= 2100 ? Number(c.year) : null;
  const fs = { 'q.givenName': c.givenName, 'q.surname': c.surname, 'q.birthLikePlace': c.place,
    'q.birthLikeDate.from': year ? String(year - 5) : undefined, 'q.birthLikeDate.to': year ? String(year + 5) : undefined, 'q.any': c.keywords,
  };
  const query = [c.givenName, c.surname, c.place, c.year, c.keywords].filter(Boolean).join(' ');
  const catalog: ResearchLink = { id: 'fs-catalog', label: 'FamilySearch · Catálogo', description: 'Fuentes, microfilmes y libros por lugar. Incluye material sin índice.', url: catalogUrl(c) };
  const records: ResearchLink = { id: 'fs-records', label: 'FamilySearch · Registros', description: 'Mismos nombres y lugar; rango de cinco años alrededor del año indicado.', url: withParams('https://www.familysearch.org/search/record/results', fs) };
  const tree: ResearchLink = { id: 'fs-tree', label: 'FamilySearch · Árbol', description: 'Personas y relaciones familiares con los mismos criterios.', url: withParams('https://www.familysearch.org/search/tree/results', fs) };
  const books: ResearchLink = { id: 'books', label: 'Libros e historia local', description: 'Referencias y publicaciones en Google Books.', url: withParams('https://www.google.com/search', { tbm: 'bks', q: query }) };
  const wiki: ResearchLink = { id: 'fs-wiki', label: 'FamilySearch · Wiki', description: 'Guías de archivos, parroquias e investigación histórica.', url: withParams('https://www.familysearch.org/en/wiki/Special:Search', { search: c.place || query }) };
  const images: ResearchLink = { id: 'fs-images', label: 'FamilySearch · Imágenes', description: 'Exploración de imágenes históricas por lugar.', url: withParams('https://www.familysearch.org/records/images/search-results', { place: c.place || undefined }) };
  const links: ResearchLink[] = [records, catalog, tree,
    { id: 'myheritage', label: 'MyHeritage', description: 'Abrir la búsqueda preparada de nombres y acontecimientos.', url: withParams('https://www.myheritage.es/research', { formId: 'master', qname: `Name fnmo.${c.givenName || ''} lnmo.${c.surname || ''}`, 'qevents-event1': year || c.place ? `Event et.birth${year ? ` ed.${year} ev.5` : ''}${c.place ? ` ep.${c.place}` : ''}` : undefined }) },
    { id: 'ancestry', label: 'Ancestry', description: 'Consultar registros con nombres, año y lugar de nacimiento.', url: withParams('https://www.ancestry.com/search/', { name: c.givenName || c.surname ? `${c.givenName || ''}_${c.surname || ''}` : undefined, birth: year || c.place ? `${year || ''}_${c.place || ''}` : undefined, keyword: c.keywords }) },
    images, books, wiki,
    { id: 'cemeteries', label: 'Cementerios · Find a Grave', description: 'Buscar memoriales por nombre y apellido.', url: withParams('https://www.findagrave.com/memorial/search', { firstname: c.givenName, lastname: c.surname }) },
  ];
  const first = ({ catalogo: catalog, arbol: tree, genealogias: tree, libros: books, wiki, imagenes: images, cementerios: links[8] } as Record<string, ResearchLink>)[mode];
  return first ? [first, ...links.filter(l => l.id !== first.id)] : links;
}
