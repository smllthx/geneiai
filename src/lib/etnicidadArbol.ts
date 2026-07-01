import { supabase } from "@/integrations/supabase/client";
import { fetchAllPeople, fetchAllRelations, getActiveTreeId } from "@/lib/peopleData";
import { normalizePlace } from "@/lib/placeNormalizer";

const MAX_GEN = 8;
const FUENTE_TAG = "Cálculo por árbol";

export type EthnicidadCalc = {
  region: string;
  porcentaje: number;
  cobertura: number;
  confianza: number;
  antepasados: number;
};

type PersonaOrigin = {
  id: string;
  nombres?: string | null;
  apellidos?: string | null;
  sexo?: string | null;
  nacionalidad?: string | null;
  nac_lugar_id?: string | null;
};

type Rel = { persona_id: string; pariente_id: string; tipo: string };
type Lugar = { id: string; pais?: string | null; region?: string | null; provincia?: string | null; ciudad?: string | null };

type OriginResolution = {
  label: string;
  country: string | null;
  region: string | null;
  confidence: number;
  source: string;
};

const fullName = (p?: PersonaOrigin | null) => [p?.nombres, p?.apellidos].filter(Boolean).join(" ") || "Persona sin nombre";

const relIsParent = (tipo: string) => ["padre", "madre", "parent", "progenitor"].includes(tipo);

function parentIds(pid: string, rels: Rel[], people: Map<string, PersonaOrigin>): string[] {
  const found: { id: string; score: number }[] = [];
  for (const r of rels) {
    if (r.persona_id === pid && relIsParent(String(r.tipo).toLowerCase())) {
      const parent = people.get(r.pariente_id);
      found.push({ id: r.pariente_id, score: parent?.sexo === "femenino" ? 2 : 1 });
    }
    if (r.pariente_id === pid && String(r.tipo).toLowerCase() === "hijo") {
      const parent = people.get(r.persona_id);
      found.push({ id: r.persona_id, score: parent?.sexo === "femenino" ? 2 : 1 });
    }
  }
  return Array.from(new Map(found.sort((a, b) => a.score - b.score).map((x) => [x.id, x.id])).values()).slice(0, 2);
}

function resolveOrigin(person: PersonaOrigin, lugares: Map<string, Lugar>): OriginResolution {
  const lugar = person.nac_lugar_id ? lugares.get(person.nac_lugar_id) : undefined;
  const rawPlace = [lugar?.ciudad, lugar?.provincia, lugar?.region, lugar?.pais].filter(Boolean).join(", ");
  const normalized = normalizePlace({
    raw: rawPlace,
    country: lugar?.pais,
    region: lugar?.region ?? lugar?.provincia,
    nationality: person.nacionalidad,
    source: person.nacionalidad ? "manual" : "field",
  });
  if (!normalized.country) {
    return {
      label: "Desconocido",
      country: null,
      region: null,
      confidence: 0,
      source: "unknown",
    };
  }
  return {
    label: [normalized.country, normalized.region].filter(Boolean).join(" · "),
    country: normalized.country,
    region: normalized.region,
    confidence: normalized.confidence,
    source: normalized.source,
  };
}

export async function calcularEtnicidadPorArbol(probandId: string) {
  const activeTreeId = await getActiveTreeId();
  const [{ data: lugares }, personas, rels] = await Promise.all([
    supabase.from("lugares").select("id,ciudad,provincia,region,pais").limit(20000),
    fetchAllPeople<PersonaOrigin>("id,nombres,apellidos,sexo,nacionalidad,nac_lugar_id", { treeId: activeTreeId }),
    fetchAllRelations<Rel>("persona_id,pariente_id,tipo", { treeId: activeTreeId }),
  ]);

  const people = new Map<string, PersonaOrigin>((personas ?? []).map((p) => [p.id, p]));
  const placeById = new Map<string, Lugar>((lugares ?? []).map((l: Lugar) => [l.id, l]));
  const totals = new Map<string, EthnicidadCalc & { weightedConfidence: number; names: Set<string> }>();
  let knownWeight = 0;
  let totalVisitedWeight = 0;

  const addOrigin = (person: PersonaOrigin, generation: number, weight: number) => {
    const origin = resolveOrigin(person, placeById);
    totalVisitedWeight += weight;
    if (origin.country) knownWeight += weight;
    const key = origin.country ? `${origin.country}|${origin.region ?? ""}` : "Desconocido|";
    const current = totals.get(key) ?? {
      region: origin.label,
      porcentaje: 0,
      cobertura: 0,
      confianza: 0,
      antepasados: 0,
      weightedConfidence: 0,
      names: new Set<string>(),
    };
    current.porcentaje += weight * 100;
    current.weightedConfidence += origin.confidence * weight;
    current.antepasados += 1;
    current.names.add(`${fullName(person)} (${generation}.ª gen)`);
    totals.set(key, current);
  };

  const visit = (id: string, generation: number, seen: Set<string>) => {
    if (generation > MAX_GEN || seen.has(id)) return;
    const person = people.get(id);
    if (!person) return;
    const weight = 1 / Math.pow(2, generation);
    addOrigin(person, generation, weight);
    const nextSeen = new Set(seen);
    nextSeen.add(id);
    for (const parentId of parentIds(id, rels ?? [], people)) {
      visit(parentId, generation + 1, nextSeen);
    }
  };

  for (const parentId of parentIds(probandId, rels ?? [], people)) {
    visit(parentId, 1, new Set([probandId]));
  }

  if (totalVisitedWeight === 0) {
    const fallback = people.get(probandId);
    if (fallback) addOrigin(fallback, 0, 1);
  }

  const coverageBase = totalVisitedWeight || 1;
  const items = Array.from(totals.values()).map((item) => ({
    region: item.region,
    porcentaje: coverageBase > 0 ? (item.porcentaje / (coverageBase * 100)) * 100 : 0,
    cobertura: knownWeight / coverageBase,
    confianza: item.porcentaje > 0 ? item.weightedConfidence / (item.porcentaje / 100) : 0,
    antepasados: item.antepasados,
  })).sort((a, b) => b.porcentaje - a.porcentaje);

  return { items, cobertura: knownWeight / coverageBase };
}

export async function guardarEtnicidadArbol(probandId: string) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("No hay sesión");
  const { items, cobertura } = await calcularEtnicidadPorArbol(probandId);
  if (items.length === 0) return { insertados: 0, cobertura };

  await supabase.from("dna_estimates").delete().eq("user_id", user.id).eq("fuente", FUENTE_TAG);

  const rows = items.map((i) => ({
    user_id: user.id,
    region: i.region,
    porcentaje: Number(i.porcentaje.toFixed(2)),
    fuente: FUENTE_TAG,
    rama: `confianza ${Math.round(i.confianza * 100)}% · ${i.antepasados} antepasado(s)`,
  }));
  const { error } = await supabase.from("dna_estimates").insert(rows);
  if (error) throw error;
  return { insertados: rows.length, cobertura };
}
