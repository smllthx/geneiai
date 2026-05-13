// Motor de inferencias familiares automáticas (R1–R8).
// Recibe snapshots cargados desde la BD y devuelve inferencias candidatas.
// No persiste nada por sí mismo; el caller hace upsert en generated_inferences.

import type { Tables } from "@/integrations/supabase/types";

export type Persona = Tables<"personas">;
export type Relacion = Tables<"relaciones">;
export type Evento = Tables<"eventos">;
export type Documento = Tables<"documentos">;
export type Lugar = Tables<"lugares">;

export interface InferenceInput {
  personas: Persona[];
  relaciones: Relacion[];
  eventos: Evento[];
  documentos: Documento[];
  lugares: Lugar[];
}

export interface Inference {
  person_id: string | null;
  inference_type: string;
  inferred_field: string | null;
  inferred_value: string | null;
  date_range_start: number | null;
  date_range_end: number | null;
  explanation: string;
  confidence_score: number;
  rule_code: string;
  related_person_ids: string[];
  related_event_ids: string[];
}

const PAISES_AMERICA = ["chile", "argentina", "uruguay", "brasil", "peru", "perú", "bolivia", "paraguay", "estados unidos", "ee.uu", "eeuu", "mexico", "méxico"];
const PAISES_EUROPA = ["italia", "italy", "españa", "espana", "spain", "francia", "alemania", "suiza", "switzerland", "portugal", "reino unido"];

const yearOf = (d: string | null): number | null => (d ? new Date(d).getUTCFullYear() : null);

const personaName = (p: Persona) => `${p.nombres} ${p.apellidos}`.trim();
const lugarName = (l: Lugar) => [l.ciudad, l.provincia, l.region, l.pais].filter(Boolean).join(", ");

function nacYear(p: Persona): number | null {
  if (p.nac_fecha) return yearOf(p.nac_fecha);
  if (p.nac_rango_ini && p.nac_rango_fin) return Math.round((p.nac_rango_ini + p.nac_rango_fin) / 2);
  return null;
}

function isAmerica(text: string | null): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return PAISES_AMERICA.some((p) => t.includes(p));
}
function isEuropa(text: string | null): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return PAISES_EUROPA.some((p) => t.includes(p));
}

// ---------- R1: padres ↔ hijos ----------
function ruleR1(input: InferenceInput): Inference[] {
  const out: Inference[] = [];
  const { personas, relaciones } = input;
  const byId = new Map(personas.map((p) => [p.id, p]));

  for (const persona of personas) {
    if (nacYear(persona) !== null) continue;

    const hijosRel = relaciones.filter(
      (r) => r.pariente_id === persona.id && r.tipo === "hijo",
    );
    const hijos = hijosRel.map((r) => byId.get(r.persona_id)).filter(Boolean) as Persona[];
    const aniosHijos = hijos.map(nacYear).filter((y): y is number => y !== null).sort((a, b) => a - b);
    if (aniosHijos.length === 0) continue;

    const primer = aniosHijos[0];
    const esMadre = persona.sexo?.toLowerCase().startsWith("f");
    const min = esMadre ? 18 : 20;
    const max = esMadre ? 42 : 45;
    const ini = primer - max;
    const fin = primer - min;
    const score = Math.min(100, 40 + hijos.length * 15);
    const hijoNombre = hijos[0] ? personaName(hijos[0]) : "su hijo";

    out.push({
      person_id: persona.id,
      inference_type: "rango_nacimiento",
      inferred_field: "nac_fecha",
      inferred_value: `${ini}–${fin}`,
      date_range_start: ini,
      date_range_end: fin,
      explanation: `Posible nacimiento de ${personaName(persona)} entre ${ini} y ${fin}. Inferido a partir del nacimiento de ${hijoNombre} en ${primer} y rango típico de edad ${esMadre ? "materna (18–42)" : "paterna (20–45)"}.`,
      confidence_score: score,
      rule_code: "R1",
      related_person_ids: hijos.map((h) => h.id),
      related_event_ids: [],
    });
  }
  return out;
}

// ---------- R2: matrimonio por hijos ----------
function ruleR2(input: InferenceInput): Inference[] {
  const out: Inference[] = [];
  const { personas, relaciones } = input;
  const byId = new Map(personas.map((p) => [p.id, p]));
  const seen = new Set<string>();

  // pares cónyuges con hijos en común
  for (const p of personas) {
    const conyuges = relaciones.filter((r) => r.persona_id === p.id && r.tipo === "conyuge").map((r) => r.pariente_id);
    for (const cId of conyuges) {
      const key = [p.id, cId].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const c = byId.get(cId);
      if (!c) continue;
      if (p.matrimonio_fecha || c.matrimonio_fecha) continue;

      const hijosP = relaciones.filter((r) => r.pariente_id === p.id && r.tipo === "hijo").map((r) => r.persona_id);
      const hijosC = new Set(relaciones.filter((r) => r.pariente_id === cId && r.tipo === "hijo").map((r) => r.persona_id));
      const comunes = hijosP.filter((h) => hijosC.has(h)).map((h) => byId.get(h)!).filter(Boolean);
      const anios = comunes.map(nacYear).filter((y): y is number => y !== null).sort((a, b) => a - b);
      if (anios.length === 0) continue;

      const primero = anios[0];
      const ini = primero - 10;
      const fin = primero;

      out.push({
        person_id: p.id,
        inference_type: "rango_matrimonio",
        inferred_field: "matrimonio_fecha",
        inferred_value: `${ini}–${fin}`,
        date_range_start: ini,
        date_range_end: fin,
        explanation: `Sugerencia: buscar matrimonio entre ${personaName(p)} y ${personaName(c)} entre ${ini} y ${fin} (0–10 años antes del nacimiento del primer hijo en común en ${primero}).`,
        confidence_score: 55 + Math.min(20, comunes.length * 5),
        rule_code: "R2",
        related_person_ids: [cId, ...comunes.map((x) => x.id)],
        related_event_ids: [],
      });
    }
  }
  return out;
}

// ---------- R3: defunción ----------
function ruleR3(input: InferenceInput): Inference[] {
  const out: Inference[] = [];
  const { personas, eventos, documentos } = input;
  const byId = new Map(personas.map((p) => [p.id, p]));

  for (const persona of personas) {
    if (persona.defuncion_fecha) continue;

    // documentos donde la persona aparece mencionada
    const docs = documentos.filter((d) => (d.personas_mencionadas ?? []).includes(persona.id) && d.fecha);
    const anios = docs.map((d) => yearOf(d.fecha)).filter((y): y is number => y !== null);
    const evs = eventos.filter((e) => e.persona_id === persona.id && e.fecha);
    for (const e of evs) { const y = yearOf(e.fecha); if (y) anios.push(y); }

    if (anios.length > 0) {
      const max = Math.max(...anios);
      out.push({
        person_id: persona.id,
        inference_type: "vivo_hasta",
        inferred_field: "defuncion_fecha",
        inferred_value: `≥ ${max}`,
        date_range_start: max,
        date_range_end: null,
        explanation: `${personaName(persona)} aparece vivo/a al menos hasta ${max} según documentos/eventos registrados.`,
        confidence_score: 50,
        rule_code: "R3",
        related_person_ids: [],
        related_event_ids: evs.map((e) => e.id),
      });
    }
  }
  return out;
}

// ---------- R4: inmigración ----------
function ruleR4(input: InferenceInput): Inference[] {
  const out: Inference[] = [];
  const { personas, relaciones, lugares } = input;
  const byId = new Map(personas.map((p) => [p.id, p]));
  const lugById = new Map(lugares.map((l) => [l.id, l]));

  for (const persona of personas) {
    const lNac = persona.nac_lugar_id ? lugById.get(persona.nac_lugar_id) : null;
    if (!lNac || !isEuropa(lNac.pais)) continue;
    const nacY = nacYear(persona);

    const hijosIds = relaciones.filter((r) => r.pariente_id === persona.id && r.tipo === "hijo").map((r) => r.persona_id);
    const hijos = hijosIds.map((id) => byId.get(id)!).filter(Boolean);
    const hijosCronol = hijos
      .map((h) => ({ h, lugar: h.nac_lugar_id ? lugById.get(h.nac_lugar_id) : null, year: nacYear(h) }))
      .filter((x) => x.year !== null)
      .sort((a, b) => a.year! - b.year!);

    let ini: number | null = nacY;
    let fin: number | null = null;
    let explicacion = "";
    let related: string[] = [];

    const ultimoEuropa = [...hijosCronol].reverse().find((x) => isEuropa(x.lugar?.pais ?? null));
    const primeroAmerica = hijosCronol.find((x) => isAmerica(x.lugar?.pais ?? null));

    if (ultimoEuropa && primeroAmerica && ultimoEuropa.year! < primeroAmerica.year!) {
      ini = ultimoEuropa.year!;
      fin = primeroAmerica.year!;
      explicacion = `Posible migración entre ${ini} y ${fin}: hijo ${personaName(ultimoEuropa.h)} nació en Europa (${ultimoEuropa.year}) y luego ${personaName(primeroAmerica.h)} nació en América (${primeroAmerica.year}).`;
      related = [ultimoEuropa.h.id, primeroAmerica.h.id];
    } else if (primeroAmerica) {
      fin = primeroAmerica.year!;
      explicacion = `Posible migración antes de ${fin}: hijo ${personaName(primeroAmerica.h)} nació en América (${primeroAmerica.year}).`;
      related = [primeroAmerica.h.id];
    } else continue;

    out.push({
      person_id: persona.id,
      inference_type: "rango_migracion",
      inferred_field: "evento_inmigracion",
      inferred_value: `${ini ?? "?"}–${fin ?? "?"}`,
      date_range_start: ini,
      date_range_end: fin,
      explanation: `${explicacion} Próxima búsqueda sugerida: listas de pasajeros del puerto correspondiente.`,
      confidence_score: 60,
      rule_code: "R4",
      related_person_ids: related,
      related_event_ids: [],
    });
  }
  return out;
}

// ---------- R5: lugares ----------
function ruleR5(input: InferenceInput): Inference[] {
  const out: Inference[] = [];
  const { personas, relaciones, lugares } = input;
  const byId = new Map(personas.map((p) => [p.id, p]));
  const lugById = new Map(lugares.map((l) => [l.id, l]));

  for (const persona of personas) {
    const hijosIds = relaciones.filter((r) => r.pariente_id === persona.id && r.tipo === "hijo").map((r) => r.persona_id);
    const hijos = hijosIds.map((id) => byId.get(id)!).filter(Boolean);
    const lugarCount = new Map<string, { lugar: Lugar; years: number[] }>();
    for (const h of hijos) {
      if (!h.nac_lugar_id) continue;
      const l = lugById.get(h.nac_lugar_id);
      if (!l) continue;
      const y = nacYear(h);
      const entry = lugarCount.get(l.id) ?? { lugar: l, years: [] };
      if (y) entry.years.push(y);
      lugarCount.set(l.id, entry);
    }
    for (const { lugar, years } of lugarCount.values()) {
      if (years.length < 2) continue;
      const ini = Math.min(...years);
      const fin = Math.max(...years);
      out.push({
        person_id: persona.id,
        inference_type: "residencia_probable",
        inferred_field: "residencia",
        inferred_value: lugarName(lugar),
        date_range_start: ini,
        date_range_end: fin,
        explanation: `${years.length} hijos de ${personaName(persona)} nacieron en ${lugarName(lugar)} entre ${ini} y ${fin}: residencia familiar probable durante ese período.`,
        confidence_score: 50 + years.length * 8,
        rule_code: "R5",
        related_person_ids: hijos.map((h) => h.id),
        related_event_ids: [],
      });
    }
  }
  return out;
}

// ---------- R7: nombres repetidos / equivalencias ----------
const EQUIV_IT_ES: Record<string, string> = {
  giovanni: "Juan", giuseppe: "José", luigi: "Luis", maria: "María",
  francesco: "Francisco", michele: "Miguel", battista: "Bautista",
  giovanna: "Juana", antonio: "Antonio", pietro: "Pedro", paolo: "Pablo",
};

function ruleR7(input: InferenceInput): Inference[] {
  const out: Inference[] = [];
  const { personas, relaciones } = input;
  const byId = new Map(personas.map((p) => [p.id, p]));

  for (const persona of personas) {
    const padres = relaciones.filter((r) => r.persona_id === persona.id && (r.tipo === "padre" || r.tipo === "madre"))
      .map((r) => byId.get(r.pariente_id)).filter(Boolean) as Persona[];
    const abuelos = padres.flatMap((p) =>
      relaciones.filter((r) => r.persona_id === p.id && (r.tipo === "padre" || r.tipo === "madre"))
        .map((r) => byId.get(r.pariente_id)).filter(Boolean) as Persona[]
    );
    const primerNombre = persona.nombres.split(/\s+/)[0]?.toLowerCase();
    if (!primerNombre) continue;
    const match = abuelos.find((a) => a.nombres.toLowerCase().split(/\s+/).includes(primerNombre));
    if (match) {
      out.push({
        person_id: persona.id,
        inference_type: "patron_nombres",
        inferred_field: "nombres",
        inferred_value: persona.nombres,
        date_range_start: null, date_range_end: null,
        explanation: `${personaName(persona)} podría llevar el nombre de su abuelo/a ${personaName(match)} (patrón tradicional de nombres familiares).`,
        confidence_score: 40,
        rule_code: "R7",
        related_person_ids: [match.id],
        related_event_ids: [],
      });
    }
    // equivalencia italiana
    const equiv = EQUIV_IT_ES[primerNombre];
    if (equiv) {
      out.push({
        person_id: persona.id,
        inference_type: "equivalencia_nombre",
        inferred_field: "variantes_nombre",
        inferred_value: equiv,
        date_range_start: null, date_range_end: null,
        explanation: `Equivalencia italiano↔español: "${persona.nombres.split(/\s+/)[0]}" puede aparecer como "${equiv}" en registros castellanos. Útil para ampliar búsquedas.`,
        confidence_score: 35,
        rule_code: "R7",
        related_person_ids: [],
        related_event_ids: [],
      });
    }
  }
  return out;
}

// ---------- R8: documentos con varias personas ----------
function ruleR8(input: InferenceInput): Inference[] {
  const out: Inference[] = [];
  const { documentos, personas } = input;
  const byId = new Map(personas.map((p) => [p.id, p]));

  for (const doc of documentos) {
    const ids = doc.personas_mencionadas ?? [];
    if (ids.length < 2) continue;
    const lista = ids.map((id) => byId.get(id)).filter(Boolean) as Persona[];
    const apellidoCount = new Map<string, Persona[]>();
    for (const p of lista) {
      const ap = p.apellidos.split(/\s+/)[0]?.toLowerCase();
      if (!ap) continue;
      const arr = apellidoCount.get(ap) ?? [];
      arr.push(p);
      apellidoCount.set(ap, arr);
    }
    for (const [ap, grupo] of apellidoCount) {
      if (grupo.length < 2) continue;
      out.push({
        person_id: grupo[0].id,
        inference_type: "grupo_familiar_documento",
        inferred_field: "relaciones",
        inferred_value: `Grupo "${ap}" en ${doc.titulo}`,
        date_range_start: null, date_range_end: null,
        explanation: `El documento "${doc.titulo}" menciona ${grupo.length} personas con apellido ${ap}: ${grupo.map(personaName).join(", ")}. Posible grupo familiar — revisar y registrar relaciones.`,
        confidence_score: 45 + grupo.length * 5,
        rule_code: "R8",
        related_person_ids: grupo.map((p) => p.id),
        related_event_ids: [],
      });
    }
  }
  return out;
}

export function generateInferences(input: InferenceInput): Inference[] {
  return [
    ...ruleR1(input),
    ...ruleR2(input),
    ...ruleR3(input),
    ...ruleR4(input),
    ...ruleR5(input),
    ...ruleR7(input),
    ...ruleR8(input),
  ];
}

export function nivelCerteza(score: number): "baja" | "media" | "alta" {
  if (score >= 70) return "alta";
  if (score >= 40) return "media";
  return "baja";
}
