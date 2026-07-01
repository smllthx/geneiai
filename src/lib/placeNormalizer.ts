export type NormalizedPlace = {
  country: string | null;
  region: string | null;
  confidence: number;
  source: "dictionary" | "field" | "manual" | "inferred" | "unknown";
  matched?: string;
};

export function normalizeText(input: unknown): string {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[.,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const placeDictionary: Record<string, { country: string; region?: string }> = {
  genova: { country: "Italia", region: "Liguria" },
  genoa: { country: "Italia", region: "Liguria" },
  liguria: { country: "Italia", region: "Liguria" },
  rapallo: { country: "Italia", region: "Liguria" },
  portofino: { country: "Italia", region: "Liguria" },
  italia: { country: "Italia" },
  italy: { country: "Italia" },
  "munsingen": { country: "Suiza", region: "Berna" },
  krauchthal: { country: "Suiza", region: "Berna" },
  bern: { country: "Suiza", region: "Berna" },
  berna: { country: "Suiza", region: "Berna" },
  suiza: { country: "Suiza" },
  switzerland: { country: "Suiza" },
  schweiz: { country: "Suiza" },
  vallenar: { country: "Chile", region: "Atacama" },
  copiapo: { country: "Chile", region: "Atacama" },
  traiguen: { country: "Chile", region: "Araucanía" },
  santiago: { country: "Chile", region: "Región Metropolitana" },
  "santiago de chile": { country: "Chile", region: "Región Metropolitana" },
  "las condes": { country: "Chile", region: "Región Metropolitana" },
  valparaiso: { country: "Chile", region: "Valparaíso" },
  antofagasta: { country: "Chile", region: "Antofagasta" },
  "los andes": { country: "Chile", region: "Valparaíso" },
  traiguen_malleco: { country: "Chile", region: "Araucanía" },
  chile: { country: "Chile" },
  espana: { country: "España" },
  spain: { country: "España" },
  yugoslavia: { country: "Yugoslavia" },
  croacia: { country: "Croacia" },
  serbia: { country: "Serbia" },
};

export function normalizePlace(input: {
  raw?: unknown;
  country?: unknown;
  region?: unknown;
  nationality?: unknown;
  source?: "manual" | "field" | "inferred";
}): NormalizedPlace {
  const nationality = normalizeText(input.nationality);
  if (nationality) {
    const byNationality = placeDictionary[nationality];
    return {
      country: byNationality?.country ?? String(input.nationality).trim(),
      region: byNationality?.region ?? null,
      confidence: byNationality ? 0.9 : 0.82,
      source: input.source ?? "manual",
      matched: nationality,
    };
  }

  const country = normalizeText(input.country);
  if (country) {
    const byCountry = placeDictionary[country];
    return {
      country: byCountry?.country ?? String(input.country).trim(),
      region: byCountry?.region ?? (input.region ? String(input.region).trim() : null),
      confidence: byCountry ? 0.84 : 0.76,
      source: "field",
      matched: country,
    };
  }

  const haystack = normalizeText([input.raw, input.region].filter(Boolean).join(" "));
  if (!haystack) return { country: null, region: null, confidence: 0, source: "unknown" };

  const exact = placeDictionary[haystack];
  if (exact) {
    return { country: exact.country, region: exact.region ?? null, confidence: 0.86, source: "dictionary", matched: haystack };
  }

  const match = Object.entries(placeDictionary)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([key]) => haystack.includes(key));

  if (!match) return { country: null, region: null, confidence: 0, source: "unknown" };

  return {
    country: match[1].country,
    region: match[1].region ?? null,
    confidence: 0.78,
    source: "dictionary",
    matched: match[0],
  };
}
