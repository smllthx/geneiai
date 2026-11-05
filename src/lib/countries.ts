import countryData from "flag-icons/country.json";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
export const countryCodes = countryData.map(c => c.code.toUpperCase()).filter(code => /^[A-Z]{2}$/.test(code));
const known = new Set(countryCodes);
const byName = new Map<string, string>();
for (const locale of ["es", "en", "it", "fr", "de", "pt"]) {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  for (const code of countryCodes) byName.set(normalize(names.of(code) || code), code);
}
for (const [code, names] of Object.entries({
  IT: ["italiano", "italiana", "italian", "italia (liguria)"], CH: ["suizo", "suiza", "svizzero", "svizzera", "swiss"],
  CL: ["chileno", "chilena", "chilean"], AR: ["argentino", "argentina", "argentinian"],
  ES: ["español", "española", "spanish"], DE: ["alemán", "alemana", "german"],
  US: ["eeuu", "ee. uu.", "usa", "estados unidos de america"], GB: ["uk", "reino unido", "gran bretaña"],
})) for (const name of names) byName.set(normalize(name), code);

/** Resolve only an explicit country or the last part of a recorded place; never guess from a surname/city. */
export function countryCode(value?: string | null): string | null {
  if (!value) return null;
  const key = value.trim().toUpperCase();
  if (known.has(key)) return key;
  const exact = byName.get(normalize(value));
  if (exact) return exact;
  const parts = value.split(",");
  return parts.length > 1 ? byName.get(normalize(parts[parts.length - 1])) || null : null;
}
export function countryName(code: string, locale = "es") { return new Intl.DisplayNames([locale], { type: "region" }).of(code) || code; }
