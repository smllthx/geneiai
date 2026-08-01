import type { SupabaseClient } from "@supabase/supabase-js";

const PUBLIC_APP_URL = "https://geneiai.vercel.app";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PERSON_SELECT = [
  "id", "nombres", "apellidos", "variantes_nombre", "sexo", "viva",
  "nac_fecha", "nac_fecha_aprox", "nac_rango_ini", "nac_rango_fin",
  "bautismo_fecha", "matrimonio_fecha", "defuncion_fecha", "entierro_fecha",
  "ocupacion", "nacionalidad", "religion", "notas", "certeza",
  "arbol_id", "updated_at", "row_version",
].join(",");

const PERSON_FIELDS = new Set([
  "nombres", "apellidos", "variantes_nombre", "sexo", "viva",
  "nac_fecha", "nac_fecha_aprox", "nac_rango_ini", "nac_rango_fin",
  "bautismo_fecha", "matrimonio_fecha", "defuncion_fecha", "entierro_fecha",
  "ocupacion", "nacionalidad", "religion", "notas", "certeza",
]);
const DATE_FIELDS = new Set([
  "nac_fecha", "bautismo_fecha", "matrimonio_fecha", "defuncion_fecha", "entierro_fecha",
]);
const TEXT_LIMITS: Record<string, number> = {
  nombres: 200,
  apellidos: 200,
  nac_fecha_aprox: 120,
  ocupacion: 240,
  nacionalidad: 160,
  religion: 160,
  notas: 8000,
};
const CERTAINTIES = new Set(["comprobado", "probable", "hipotesis", "descartado"]);
const LIVING_STATUSES = new Set(["si", "no", "desconocido"]);
const SEXES = new Set(["masculino", "femenino", "otro"]);
const RELATION_TYPES = new Set(["padre", "madre", "hijo", "conyuge", "hermano", "otro"]);
const RELATION_NATURES = new Set(["biologica", "adoptiva", "desconocida"]);
const SUGGESTION_TYPES = new Set([
  "nueva_persona", "actualizar_persona", "nueva_relacion", "nuevo_evento", "nueva_fuente", "otro",
]);
const FORBIDDEN_PROPOSAL_FIELDS = new Set([
  "id", "user_id", "arbol_id", "created_at", "updated_at", "row_version",
]);

type JsonObject = Record<string, unknown>;
type PersonRecord = JsonObject & {
  id: string;
  nombres?: string;
  apellidos?: string;
  sexo?: string | null;
  row_version?: number;
};

export class GeneaiWorkError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "GeneaiWorkError";
    this.code = code;
    this.status = status;
  }
}

function assertUuid(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new GeneaiWorkError("INVALID_ID", `${label} no es un identificador válido.`);
  }
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function cleanText(value: unknown, field: string, max: number, nullable = true) {
  if (value === null && nullable) return null;
  if (typeof value !== "string") {
    throw new GeneaiWorkError("INVALID_FIELD", `${field} debe ser texto.`);
  }
  const cleaned = value.trim();
  if (!cleaned && !nullable) {
    throw new GeneaiWorkError("INVALID_FIELD", `${field} no puede quedar vacío.`);
  }
  if (cleaned.length > max) {
    throw new GeneaiWorkError("INVALID_FIELD", `${field} supera el máximo de ${max} caracteres.`);
  }
  return cleaned || null;
}

function sanitizePersonFields(input: JsonObject, mode: "create" | "update") {
  const unknownFields = Object.keys(input).filter((key) => !PERSON_FIELDS.has(key));
  if (unknownFields.length) {
    throw new GeneaiWorkError(
      "FORBIDDEN_FIELDS",
      `GENEAI no permite modificar estos campos desde Work: ${unknownFields.join(", ")}.`,
    );
  }

  const output: JsonObject = {};
  for (const [field, value] of Object.entries(input)) {
    if (field === "nombres" || field === "apellidos") {
      output[field] = cleanText(value, field, TEXT_LIMITS[field], false);
      continue;
    }
    if (field === "variantes_nombre") {
      if (!Array.isArray(value) || value.length > 40) {
        throw new GeneaiWorkError("INVALID_FIELD", "variantes_nombre debe ser una lista de hasta 40 nombres.");
      }
      output[field] = value.map((item) => cleanText(item, field, 120, false));
      continue;
    }
    if (field === "sexo") {
      if (value !== null && (typeof value !== "string" || !SEXES.has(value))) {
        throw new GeneaiWorkError("INVALID_FIELD", "sexo debe ser masculino, femenino, otro o nulo.");
      }
      output[field] = value;
      continue;
    }
    if (field === "viva") {
      if (typeof value !== "string" || !LIVING_STATUSES.has(value)) {
        throw new GeneaiWorkError("INVALID_FIELD", "viva debe ser si, no o desconocido.");
      }
      output[field] = value;
      continue;
    }
    if (field === "certeza") {
      if (typeof value !== "string" || !CERTAINTIES.has(value)) {
        throw new GeneaiWorkError("INVALID_FIELD", "certeza no es válida.");
      }
      output[field] = value;
      continue;
    }
    if (DATE_FIELDS.has(field)) {
      if (value !== null && (typeof value !== "string" || !isValidDate(value))) {
        throw new GeneaiWorkError("INVALID_DATE", `${field} debe usar una fecha real en formato AAAA-MM-DD.`);
      }
      output[field] = value;
      continue;
    }
    if (field === "nac_rango_ini" || field === "nac_rango_fin") {
      if (value !== null && (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 3000)) {
        throw new GeneaiWorkError("INVALID_FIELD", `${field} debe ser un año válido.`);
      }
      output[field] = value;
      continue;
    }
    const max = TEXT_LIMITS[field];
    if (max) output[field] = cleanText(value, field, max);
  }

  if (mode === "create") {
    if (!output.nombres || !output.apellidos) {
      throw new GeneaiWorkError("MISSING_NAME", "Para crear una persona se requieren nombres y apellidos.");
    }
  } else if (!Object.keys(output).length) {
    throw new GeneaiWorkError("EMPTY_UPDATE", "Incluye al menos un cambio permitido.");
  }
  return output;
}

function validateChronology(person: JsonObject) {
  const birth = typeof person.nac_fecha === "string" ? person.nac_fecha : null;
  const death = typeof person.defuncion_fecha === "string" ? person.defuncion_fecha : null;
  const marriage = typeof person.matrimonio_fecha === "string" ? person.matrimonio_fecha : null;
  if (birth && death && death < birth) {
    throw new GeneaiWorkError("INVALID_CHRONOLOGY", "La defunción no puede ser anterior al nacimiento.");
  }
  if (birth && marriage && marriage < birth) {
    throw new GeneaiWorkError("INVALID_CHRONOLOGY", "El matrimonio no puede ser anterior al nacimiento.");
  }
  const start = typeof person.nac_rango_ini === "number" ? person.nac_rango_ini : null;
  const end = typeof person.nac_rango_fin === "number" ? person.nac_rango_fin : null;
  if (start !== null && end !== null && end < start) {
    throw new GeneaiWorkError("INVALID_CHRONOLOGY", "El rango de nacimiento está invertido.");
  }
}

function assertSafeProposalPayload(value: unknown, path = "payload", depth = 0): void {
  if (depth > 8) {
    throw new GeneaiWorkError("INVALID_SUGGESTION", "La propuesta tiene demasiados niveles.");
  }
  if (Array.isArray(value)) {
    for (const item of value) assertSafeProposalPayload(item, path, depth + 1);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as JsonObject)) {
    if (FORBIDDEN_PROPOSAL_FIELDS.has(key)) {
      throw new GeneaiWorkError(
        "FORBIDDEN_FIELDS",
        `GENEAI no permite incluir ${path}.${key} en una propuesta de Work.`,
      );
    }
    assertSafeProposalPayload(child, `${path}.${key}`, depth + 1);
  }
}

function sanitizeSuggestionPayload(type: string, payload: JsonObject) {
  assertSafeProposalPayload(payload);
  if (type === "nueva_persona") {
    const clean = sanitizePersonFields(payload, "create");
    validateChronology(clean);
    return clean;
  }
  if (type === "actualizar_persona") {
    return sanitizePersonFields(payload, "update");
  }
  return payload;
}

function dbFailure(action: string, error: unknown): never {
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message).slice(0, 500)
    : "Error de base de datos";
  throw new GeneaiWorkError("DATABASE_ERROR", `No se pudo ${action}: ${message}`, 502);
}

function personUrl(id: string) {
  return `${PUBLIC_APP_URL}/personas/${id}`;
}

async function bestEffortAudit(
  sb: SupabaseClient,
  userId: string,
  treeId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  payload: JsonObject,
) {
  try {
    await sb.from("work_audit_log").insert({
      user_id: userId,
      arbol_id: treeId,
      source: "chatgpt_work",
      action,
      entity_type: entityType,
      entity_id: entityId,
      payload,
    });
  } catch {
    // The main operation remains valid if an older deployment has not applied the audit migration yet.
  }
}

async function treeListing(sb: SupabaseClient, userId: string) {
  assertUuid(userId, "userId");
  const [{ data: trees, error: treeError }, { data: profile, error: profileError }] = await Promise.all([
    sb.from("arboles")
      .select("id,nombre,descripcion,is_default,created_at,updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    sb.from("profiles").select("active_arbol_id").eq("id", userId).maybeSingle(),
  ]);
  if (treeError) dbFailure("leer los árboles", treeError);
  if (profileError) dbFailure("leer el perfil", profileError);

  const ownedTrees = trees ?? [];
  const requestedId = profile?.active_arbol_id ?? null;
  const active = requestedId
    ? ownedTrees.find((tree) => tree.id === requestedId) ?? null
    : null;
  return { trees: ownedTrees, activeTree: active };
}

async function requireActiveTree(sb: SupabaseClient, userId: string) {
  const { activeTree } = await treeListing(sb, userId);
  if (!activeTree) {
    throw new GeneaiWorkError(
      "NO_ACTIVE_TREE",
      "Tu cuenta no tiene un árbol activo. Crea o selecciona uno en Configuración de GENEAI.",
      409,
    );
  }
  return activeTree;
}

async function requireOwnedPerson(sb: SupabaseClient, userId: string, treeId: string, personId: string) {
  assertUuid(personId, "personId");
  const { data, error } = await sb.from("personas")
    .select(PERSON_SELECT)
    .eq("id", personId)
    .eq("user_id", userId)
    .eq("arbol_id", treeId)
    .maybeSingle();
  if (error) dbFailure("leer la persona", error);
  if (!data) {
    throw new GeneaiWorkError("PERSON_NOT_FOUND", "La persona no existe en tu árbol activo o no tienes acceso.", 404);
  }
  return data as unknown as PersonRecord;
}

export async function listTrees(sb: SupabaseClient, userId: string) {
  const { trees, activeTree } = await treeListing(sb, userId);
  return {
    activeTreeId: activeTree?.id ?? null,
    trees: trees.map((tree) => ({ ...tree, active: tree.id === activeTree?.id })),
  };
}

export async function getTreeContext(sb: SupabaseClient, userId: string) {
  const tree = await requireActiveTree(sb, userId);
  const [people, relationships, documents] = await Promise.all([
    sb.from("personas").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("arbol_id", tree.id),
    sb.from("relaciones").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("arbol_id", tree.id),
    sb.from("documentos").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("arbol_id", tree.id),
  ]);
  if (people.error) dbFailure("contar las personas", people.error);
  if (relationships.error) dbFailure("contar las relaciones", relationships.error);
  if (documents.error) dbFailure("contar los documentos", documents.error);
  return {
    tree,
    counts: {
      people: people.count ?? 0,
      relationships: relationships.count ?? 0,
      documents: documents.count ?? 0,
    },
    appUrl: `${PUBLIC_APP_URL}/arbol`,
  };
}

export async function searchPeople(
  sb: SupabaseClient,
  userId: string,
  input: { query?: string; limit?: number },
) {
  const tree = await requireActiveTree(sb, userId);
  const query = String(input.query ?? "").trim().slice(0, 240);
  const limit = Math.max(1, Math.min(50, Number.isFinite(input.limit) ? Number(input.limit) : 20));
  const base = () => sb.from("personas")
    .select("id,nombres,apellidos,sexo,nac_fecha,defuncion_fecha,ocupacion,nacionalidad,certeza,viva,updated_at,row_version")
    .eq("user_id", userId)
    .eq("arbol_id", tree.id);

  let people: Array<Record<string, unknown>> = [];
  if (!query) {
    const { data, error } = await base().order("updated_at", { ascending: false }).limit(limit);
    if (error) dbFailure("buscar personas", error);
    people = data ?? [];
  } else {
    const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    const [byName, bySurname] = await Promise.all([
      base().ilike("nombres", pattern).order("apellidos", { ascending: true }).limit(limit),
      base().ilike("apellidos", pattern).order("apellidos", { ascending: true }).limit(limit),
    ]);
    if (byName.error) dbFailure("buscar personas por nombre", byName.error);
    if (bySurname.error) dbFailure("buscar personas por apellido", bySurname.error);
    const merged = new Map<string, Record<string, unknown>>();
    for (const person of [...(byName.data ?? []), ...(bySurname.data ?? [])]) merged.set(person.id, person);
    people = [...merged.values()].slice(0, limit);
  }

  const results = people.map((person) => ({
    ...person,
    title: [person.nombres, person.apellidos].filter(Boolean).join(" "),
    url: personUrl(String(person.id)),
  }));
  return { treeId: tree.id, query, total: results.length, results };
}

export async function getPerson(
  sb: SupabaseClient,
  userId: string,
  input: { personId: string },
) {
  const tree = await requireActiveTree(sb, userId);
  const person = await requireOwnedPerson(sb, userId, tree.id, input.personId);
  const { data: relations, error: relationError } = await sb.from("relaciones")
    .select("id,persona_id,pariente_id,tipo,naturaleza,certeza,notas,updated_at,row_version")
    .eq("user_id", userId)
    .eq("arbol_id", tree.id)
    .or(`persona_id.eq.${person.id},pariente_id.eq.${person.id}`);
  if (relationError) dbFailure("leer las relaciones", relationError);

  const relativeIds = [...new Set((relations ?? []).map((relation) =>
    relation.persona_id === person.id ? relation.pariente_id : relation.persona_id,
  ))];
  let relatives: Array<Record<string, unknown>> = [];
  if (relativeIds.length) {
    const { data, error } = await sb.from("personas")
      .select("id,nombres,apellidos,sexo,nac_fecha,defuncion_fecha")
      .eq("user_id", userId)
      .eq("arbol_id", tree.id)
      .in("id", relativeIds);
    if (error) dbFailure("leer los familiares", error);
    relatives = data ?? [];
  }
  const byId = new Map(relatives.map((relative) => [relative.id, relative]));

  const safeRelations = (relations ?? []).filter((relation) => {
    const relativeId = relation.persona_id === person.id ? relation.pariente_id : relation.persona_id;
    return byId.has(relativeId);
  });

  return {
    person: { ...person, url: personUrl(person.id) },
    relationships: safeRelations.map((relation) => {
      const relativeId = relation.persona_id === person.id ? relation.pariente_id : relation.persona_id;
      const relative = byId.get(relativeId) ?? null;
      return {
        ...relation,
        direction: relation.persona_id === person.id ? "outgoing" : "incoming",
        relative: relative ? { ...relative, url: personUrl(String(relative.id)) } : null,
      };
    }),
    url: personUrl(person.id),
  };
}

export async function createPerson(sb: SupabaseClient, userId: string, input: JsonObject) {
  const tree = await requireActiveTree(sb, userId);
  const clean = sanitizePersonFields(input, "create");
  validateChronology(clean);
  const { data, error } = await sb.from("personas")
    .insert({ ...clean, user_id: userId, arbol_id: tree.id })
    .select(PERSON_SELECT)
    .single();
  if (error) dbFailure("crear la persona", error);
  const created = data as unknown as PersonRecord;
  await bestEffortAudit(sb, userId, tree.id, "create_person", "persona", created.id, { after: created });
  return { person: created, url: personUrl(created.id) };
}

export async function updatePerson(
  sb: SupabaseClient,
  userId: string,
  input: { personId: string; changes: JsonObject; expectedRowVersion: number },
) {
  const tree = await requireActiveTree(sb, userId);
  const current = await requireOwnedPerson(sb, userId, tree.id, input.personId);
  const clean = sanitizePersonFields(input.changes ?? {}, "update");
  validateChronology({ ...current, ...clean });

  if (!Number.isInteger(input.expectedRowVersion) || input.expectedRowVersion < 1) {
    throw new GeneaiWorkError("INVALID_VERSION", "expectedRowVersion no es válida.");
  }
  if (current.row_version !== input.expectedRowVersion) {
    throw new GeneaiWorkError(
      "EDIT_CONFLICT",
      "La ficha cambió desde que Work la leyó. Vuelve a abrirla antes de guardar para no sobrescribir datos nuevos.",
      409,
    );
  }

  const query = sb.from("personas")
    .update(clean)
    .eq("id", current.id)
    .eq("user_id", userId)
    .eq("arbol_id", tree.id)
    .eq("row_version", input.expectedRowVersion);
  const { data, error } = await query.select(PERSON_SELECT).maybeSingle();
  if (error) dbFailure("actualizar la persona", error);
  if (!data) {
    throw new GeneaiWorkError(
      "EDIT_CONFLICT",
      "La ficha cambió antes de guardar. Vuelve a abrirla e intenta de nuevo.",
      409,
    );
  }
  const updated = data as unknown as PersonRecord;

  await bestEffortAudit(sb, userId, tree.id, "update_person", "persona", updated.id, {
    before: current,
    changes: clean,
    after: updated,
  });
  return { person: updated, url: personUrl(updated.id) };
}

export async function createRelationship(
  sb: SupabaseClient,
  userId: string,
  input: {
    sourcePersonId: string;
    targetPersonId: string;
    type: string;
    nature?: string | null;
    certainty?: string | null;
    notes?: string | null;
  },
) {
  assertUuid(input.sourcePersonId, "sourcePersonId");
  assertUuid(input.targetPersonId, "targetPersonId");
  if (input.sourcePersonId === input.targetPersonId) {
    throw new GeneaiWorkError("SELF_RELATION", "Una persona no puede relacionarse consigo misma.");
  }
  if (!RELATION_TYPES.has(input.type)) {
    throw new GeneaiWorkError("INVALID_RELATION", "El tipo de relación no es válido.");
  }
  const nature = input.nature ?? "biologica";
  const relationCertainty = input.certainty ?? "probable";
  if (!RELATION_NATURES.has(nature)) {
    throw new GeneaiWorkError("INVALID_RELATION", "La naturaleza de la relación no es válida.");
  }
  if (!CERTAINTIES.has(relationCertainty)) {
    throw new GeneaiWorkError("INVALID_RELATION", "La certeza de la relación no es válida.");
  }
  const notes = input.notes == null ? null : cleanText(input.notes, "notes", 4000);

  const tree = await requireActiveTree(sb, userId);
  const [source, target] = await Promise.all([
    requireOwnedPerson(sb, userId, tree.id, input.sourcePersonId),
    requireOwnedPerson(sb, userId, tree.id, input.targetPersonId),
  ]);

  let inverse = input.type;
  if (input.type === "padre" || input.type === "madre") inverse = "hijo";
  else if (input.type === "hijo") inverse = target.sexo === "femenino" ? "madre" : target.sexo === "masculino" ? "padre" : "otro";

  const rows = [
    {
      user_id: userId,
      arbol_id: tree.id,
      persona_id: source.id,
      pariente_id: target.id,
      tipo: input.type,
      naturaleza: nature,
      certeza: relationCertainty,
      notas: notes,
    },
    {
      user_id: userId,
      arbol_id: tree.id,
      persona_id: target.id,
      pariente_id: source.id,
      tipo: inverse,
      naturaleza: nature,
      certeza: relationCertainty,
      notas: notes,
    },
  ];
  const { error } = await sb.from("relaciones")
    .upsert(rows, { onConflict: "user_id,persona_id,pariente_id,tipo", ignoreDuplicates: true });
  if (error) dbFailure("crear la relación", error);
  await bestEffortAudit(sb, userId, tree.id, "create_relationship", "relacion", null, {
    sourcePersonId: source.id,
    targetPersonId: target.id,
    type: input.type,
    inverseType: inverse,
  });
  return {
    created: rows.length,
    source: { id: source.id, title: `${source.nombres} ${source.apellidos}`.trim(), url: personUrl(source.id) },
    target: { id: target.id, title: `${target.nombres} ${target.apellidos}`.trim(), url: personUrl(target.id) },
    type: input.type,
    inverseType: inverse,
  };
}

export async function proposeChange(
  sb: SupabaseClient,
  userId: string,
  input: {
    type: string;
    title: string;
    description?: string | null;
    personId?: string | null;
    payload: JsonObject;
    confidence?: number;
    origin?: string;
  },
) {
  if (!SUGGESTION_TYPES.has(input.type)) {
    throw new GeneaiWorkError("INVALID_SUGGESTION", "El tipo de propuesta no es válido.");
  }
  const title = cleanText(input.title, "title", 240, false);
  const description = input.description == null ? null : cleanText(input.description, "description", 4000);
  const origin = input.origin == null ? "chatgpt_work" : cleanText(input.origin, "origin", 120, false);
  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    throw new GeneaiWorkError("INVALID_SUGGESTION", "payload debe ser un objeto.");
  }
  if (JSON.stringify(input.payload).length > 50_000) {
    throw new GeneaiWorkError("INVALID_SUGGESTION", "La propuesta es demasiado grande.");
  }
  const confidence = input.confidence ?? 0.6;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new GeneaiWorkError("INVALID_SUGGESTION", "confidence debe estar entre 0 y 1.");
  }

  const safePayload = sanitizeSuggestionPayload(input.type, input.payload);
  const tree = await requireActiveTree(sb, userId);
  if (input.type === "actualizar_persona" && !input.personId) {
    throw new GeneaiWorkError("INVALID_SUGGESTION", "La propuesta de actualización requiere personId.");
  }
  if (input.personId) await requireOwnedPerson(sb, userId, tree.id, input.personId);
  const { data, error } = await sb.from("sugerencias").insert({
    user_id: userId,
    arbol_id: tree.id,
    tipo: input.type,
    titulo: title,
    descripcion: description,
    persona_id: input.personId ?? null,
    payload: safePayload,
    confianza: Math.round(confidence * 100),
    origen: origin,
    estado: "pendiente",
  }).select("id,tipo,titulo,estado,confianza,created_at").single();
  if (error) dbFailure("guardar la propuesta", error);
  await bestEffortAudit(sb, userId, tree.id, "propose_change", "sugerencia", data.id, { after: data });
  return {
    suggestion: data,
    reviewUrl: `${PUBLIC_APP_URL}/sugerencias`,
  };
}

export const __test = {
  sanitizePersonFields,
  sanitizeSuggestionPayload,
  validateChronology,
  isValidDate,
};
