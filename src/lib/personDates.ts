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
