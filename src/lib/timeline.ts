import { birthLabel, birthSortYear, type BirthFields } from "./personDates";
import { localizeDateLabel, localeFor, type Language } from "./language";

export type TimelinePerson = BirthFields & {
  id: string; nombres: string; apellidos?: string | null; foto_url?: string | null;
  bautismo_fecha?: string | null; matrimonio_fecha?: string | null; defuncion_fecha?: string | null; entierro_fecha?: string | null;
  nac_lugar_id?: string | null; bautismo_lugar_id?: string | null; matrimonio_lugar_id?: string | null; defuncion_lugar_id?: string | null; entierro_lugar_id?: string | null;
};
export type TimelineEvent = {
  id: string; persona_id: string; tipo: string; fecha?: string | null; fecha_aprox?: string | null;
  rango_ini?: number | null; rango_fin?: number | null; descripcion?: string | null;
  lugar_id?: string | null; lugar_original?: string | null; fuente_id?: string | null; certeza?: string | null;
};
export type TimelinePlace = { id: string; ciudad?: string | null; provincia?: string | null; region?: string | null; pais?: string | null; parroquia?: string | null };
export type TimelineItem = { id: string; person?: TimelinePerson; type: string; date?: string | null; dateLabel: string; year: number | null; place: string; country?: string | null; description?: string | null; sourceId?: string | null; certainty?: string | null };
export const eventTypes: Record<string, { label: string; icon: string }> = {
  nacimiento: { label: "Nacimiento", icon: "birth" }, bautismo: { label: "Bautismo", icon: "baptism" },
  matrimonio: { label: "Matrimonio", icon: "marriage" }, defuncion: { label: "Defunción", icon: "death" },
  entierro: { label: "Entierro", icon: "death" }, migracion: { label: "Migración", icon: "ship" },
  residencia: { label: "Residencia", icon: "home" }, ocupacion: { label: "Oficio", icon: "work" },
  viaje: { label: "Viaje", icon: "ship" }, censo: { label: "Censo", icon: "document" },
  documento: { label: "Documento", icon: "document" }, evento: { label: "Evento", icon: "spark" },
};
export function eventType(value: string): string {
  const key = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/migracion/.test(key)) return "migracion";
  if (/domicilio/.test(key)) return "residencia";
  if (/oficio|profesion/.test(key)) return "ocupacion";
  if (/fuente/.test(key)) return "documento";
  return Object.keys(eventTypes).find(type => key.includes(type)) || "evento";
}
function dateFields(event: TimelineEvent): BirthFields {
  return { nac_fecha: event.fecha, nac_fecha_aprox: event.fecha_aprox, nac_rango_ini: event.rango_ini, nac_rango_fin: event.rango_fin };
}

/** Keep real events and their evidence; suppress only a redundant vital-fact placeholder. */
export function buildTimeline(people: TimelinePerson[], events: TimelineEvent[], places: TimelinePlace[] = []): TimelineItem[] {
  const peopleById = new Map(people.map(p => [p.id, p]));
  const placesById = new Map(places.map(p => [p.id, p]));
  const place = (id?: string | null, original?: string | null) => {
    const p = id ? placesById.get(id) : undefined;
    return { place: original || (p ? [p.parroquia, p.ciudad, p.provincia, p.region, p.pais].filter(Boolean).join(", ") : ""), country: p?.pais };
  };
  const out: TimelineItem[] = events.map(e => ({
    id: `event:${e.id}`, person: peopleById.get(e.persona_id), type: eventType(e.tipo),
    date: e.fecha, dateLabel: birthLabel(dateFields(e)), year: birthSortYear(dateFields(e)),
    ...place(e.lugar_id, e.lugar_original), description: e.descripcion, sourceId: e.fuente_id, certainty: e.certeza,
  }));
  const actual = new Set(events.map(e => `${e.persona_id}|${eventType(e.tipo)}|${e.fecha || birthLabel(dateFields(e))}`));
  const vitalTypes = [
    ["nacimiento", "nac_fecha", "nac_lugar_id"], ["bautismo", "bautismo_fecha", "bautismo_lugar_id"],
    ["matrimonio", "matrimonio_fecha", "matrimonio_lugar_id"], ["defuncion", "defuncion_fecha", "defuncion_lugar_id"],
    ["entierro", "entierro_fecha", "entierro_lugar_id"],
  ] as const;
  for (const p of people) for (const [type, field, location] of vitalTypes) {
    const fields = type === "nacimiento" ? p : { nac_fecha: p[field] };
    const label = birthLabel(fields);
    if (!label || actual.has(`${p.id}|${type}|${p[field] || label}`)) continue;
    out.push({ id: `vital:${p.id}:${type}`, person: p, type, date: p[field], dateLabel: label, year: birthSortYear(fields), ...place(p[location]) });
  }
  return out.sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity) || (a.date || "").localeCompare(b.date || "") || a.id.localeCompare(b.id));
}

export function timelineDate(item: TimelineItem, language: Language, detailed = false) {
  if (item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
    const date = new Date(`${item.date}T12:00:00Z`);
    if (Number.isFinite(date.getTime())) return new Intl.DateTimeFormat(localeFor(language), { year: "numeric", month: detailed ? "long" : "short", day: "numeric", timeZone: "UTC" }).format(date);
  }
  return localizeDateLabel(item.dateLabel, language);
}
