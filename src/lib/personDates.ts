export type BirthFields = {
  nac_fecha?: string | null;
  nac_fecha_aprox?: string | null;
  nac_rango_ini?: number | null;
  nac_rango_fin?: number | null;
};

type LifeFields = BirthFields & { defuncion_fecha?: string | null; viva?: string | null };
const longDate = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** A missing day or month is never filled in from an estimate. */
export function birthLabel(p: BirthFields, detailed = false): string {
  const exact = p.nac_fecha?.trim();
  if (exact && !/^[?\s–-]+$/.test(exact)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(exact)) {
      const date = new Date(exact);
      if (Number.isFinite(date.getTime())) return detailed ? longDate.format(date) : exact.slice(0, 4);
    }
    return exact;
  }
  const approx = p.nac_fecha_aprox?.trim();
  if (approx && !/^[?\s–-]+$/.test(approx)) {
    if (/^\d{3,4}$/.test(approx)) return `hacia ${approx}`;
    return approx.replace(/^(ABT|CAL|EST)\s+/i, "hacia ").replace(/^BEF\s+/i, "antes de ")
      .replace(/^AFT\s+/i, "después de ").replace(/^BET (.+) AND (.+)$/i, "entre $1 y $2");
  }
  const start = p.nac_rango_ini, end = p.nac_rango_fin;
  if (start != null && end != null) return start === end ? String(start) : `entre ${start} y ${end}`;
  if (start != null) return `desde ${start}`;
  if (end != null) return `hasta ${end}`;
  return "";
}

/** Chronological order only. Never present a range boundary as a known birth year. */
export function birthSortYear(p: BirthFields): number | null {
  const match = birthLabel(p).match(/\b\d{3,4}\b/);
  return match ? Number(match[0]) : null;
}

export function lifeDates(p: LifeFields): string {
  const born = birthLabel(p);
  const died = p.defuncion_fecha?.match(/\d{4}/)?.[0];
  if (born && died) return /^\d+$/.test(born) ? `${born}–${died}` : `n. ${born} · f. ${died}`;
  if (born) return p.viva === "si" ? `${born}–Vive` : `n. ${born}`;
  if (died) return `f. ${died}`;
  return p.viva === "si" ? "Vive" : "";
}

function exactParts(value?: string | null): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;
  const parts = match.slice(1).map(Number) as [number, number, number];
  const date = new Date(`${value}T12:00:00Z`);
  return date.getUTCFullYear() === parts[0] && date.getUTCMonth() + 1 === parts[1] && date.getUTCDate() === parts[2] ? parts : null;
}

/** Completed years for full dates; explicit approximation for partial dates. */
export function ageAt(person: BirthFields, end?: string | null): string | null {
  const birth = exactParts(person.nac_fecha), finish = exactParts(end);
  if (birth && finish) {
    const years = finish[0] - birth[0] - Number(finish[1] < birth[1] || (finish[1] === birth[1] && finish[2] < birth[2]));
    return years < 0 ? null : `${years} años`;
  }
  const endYear = end?.match(/^\d{3,4}(?=$|[- ])/);
  if (!endYear) return null;
  const raw = person.nac_fecha || person.nac_fecha_aprox || "";
  if (/^(BEF|AFT)|antes|después|desde|hasta/i.test(raw.trim())) return null;
  const years = raw.match(/\b\d{3,4}\b/g)?.map(Number) || [];
  if (person.nac_rango_ini != null) years.push(person.nac_rango_ini);
  if (person.nac_rango_fin != null) years.push(person.nac_rango_fin);
  if (!years.length) return null;
  const low = Number(endYear[0]) - Math.max(...years), high = Number(endYear[0]) - Math.min(...years);
  return low < 0 ? null : `aprox. ${low === high ? high : `${low}–${high}`} años`;
}

export function personAge(person: LifeFields, today = new Date().toISOString().slice(0, 10)): string | null {
  if (person.viva === "si" && person.defuncion_fecha) return null;
  return ageAt(person, person.defuncion_fecha || (person.viva === "si" ? today : null));
}
