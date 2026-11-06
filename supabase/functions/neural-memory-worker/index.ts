// supabase/functions/neural-memory-worker/index.ts
import { createClient as createClient2 } from "npm:@supabase/supabase-js@2.105.4";

import { compareIdentity, MODEL_VERSION } from "../_shared/neuralIdentity.ts";
// api/_lib/memoryEvidence.ts
import { createHash } from "node:crypto";
function objects(input) {
  return Array.isArray(input) ? input.filter((v) => v !== null && typeof v === "object" && !Array.isArray(v)) : [];
}
var clean = (v) => typeof v === "string" ? v.trim() : "";
var norm = (v) => clean(v).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ");
function sourceExcerpt(text, name, proposed) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu");
  if (proposed && proposed.length <= 420 && text.includes(proposed) && pattern.test(proposed))
    return proposed;
  const match = pattern.exec(text);
  if (!match) return null;
  return text.slice(Math.max(0, match.index - 70), match.index + match[0].length + 100).trim();
}
function documentMentions(extracted, text) {
  const mentions = /* @__PURE__ */ new Map();
  for (const item of objects(extracted.names)) {
    const name = clean(item.source_name) || clean(item.full_name);
    if (name.length < 3 || name.length > 160) continue;
    const excerpt = sourceExcerpt(text, name, clean(item.evidence));
    if (!excerpt) continue;
    const fullName = clean(item.full_name) || name;
    const isMention = (v) => [norm(name), norm(fullName)].includes(norm(v));
    const dates = objects(extracted.dates).filter((d) => isMention(d.person_name));
    const year = (type) => {
      const date = dates.find((d) => norm(d.type) === type);
      const years = clean(date?.value).match(/\b\d{4}\b/g);
      return years?.length === 1 && excerpt.includes(years[0]) ? Number(years[0]) : null;
    };
    const relatives = objects(extracted.relationships).filter((r) => /^(padre|madre|conyuge|hijo|hermano)$/.test(norm(r.relationship))).map(
      (r) => isMention(r.person_a) ? clean(r.person_b) : isMention(r.person_b) ? clean(r.person_a) : ""
    ).filter((relative) => relative && !isMention(relative) && norm(excerpt).includes(norm(relative)));
    const key = createHash("sha256").update([norm(name), norm(item.role), excerpt].join("\n")).digest("hex");
    mentions.set(key, {
      key,
      excerpt,
      profile: { name, birthYear: year("nacimiento"), deathYear: year("defuncion"), relatives }
    });
  }
  return [...mentions.values()];
}

// api/_lib/neuralMemory.ts
var INDEX = "neural_person_index";
var NOTES = "neural_identity_notes";
var PEOPLE_FIELDS = "person_id,name,aliases,birth_year,death_year,birth_place,relatives,changed_at,processed_at";
var scopeFilter = ({ userId, treeId }) => ({ user_id: userId, arbol_id: treeId });
var profile = (p) => ({
  revision: p.changed_at,
  id: p.person_id,
  name: p.name,
  aliases: p.aliases,
  birthYear: p.birth_year,
  deathYear: p.death_year,
  birthPlace: p.birth_place,
  relatives: p.relatives
});
async function readTree(sb, scope) {
  const rows = [];
  let after;
  for (; ; ) {
    let query = sb.from(INDEX).select(PEOPLE_FIELDS).match(scopeFilter(scope)).order("person_id").limit(500);
    if (after) query = query.gt("person_id", after);
    const { data } = await query.throwOnError();
    rows.push(...data);
    if (data.length < 500) return rows;
    after = data[data.length - 1].person_id;
  }
}
function nameKeys(p) {
  const keys = /* @__PURE__ */ new Set();
  for (const name of [p.name, ...p.aliases ?? []]) {
    for (const token of name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().split(/[^\p{L}]+/u)) {
      if (token.length >= 3) {
        keys.add(`p:${token.slice(0, 3)}`);
        keys.add(`s:${token.slice(-3)}`);
      } else if (token.length >= 2) keys.add(`w:${token}`);
    }
  }
  return keys;
}
function buildIndex(rows) {
  const tokens = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const p = profile(row);
    for (const key of nameKeys(p)) {
      const group = tokens.get(key);
      if (group) group.push(p);
      else tokens.set(key, [p]);
    }
  }
  return tokens;
}
function rank(p, tokens) {
  const options = /* @__PURE__ */ new Set();
  for (const key of nameKeys(p))
    for (const candidate of tokens.get(key) ?? []) if (candidate.id !== p.id) options.add(candidate);
  return [...options].map((candidate) => ({ candidate, ...compareIdentity(p, candidate) })).filter((result) => result.score >= 0.7).sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id)).slice(0, 8);
}
function personNotes(p, index, scope) {
  return rank(p, index).map(({ candidate, score, reasons, conflicts }) => {
    const [left, right] = p.id < candidate.id ? [p, candidate] : [candidate, p];
    return {
      ...scopeFilter(scope),
      source_person_id: left.id,
      source_version: left.revision,
      candidate_version: right.revision,
      candidate_person_id: right.id,
      document_id: null,
      source_key: `person:${left.id}`,
      subject_name: left.name,
      candidate_name: right.name,
      source_label: "Fichas del \xE1rbol",
      excerpt: null,
      score,
      reasons,
      conflicts,
      model_version: MODEL_VERSION
    };
  });
}
async function saveNotes(sb, notes) {
  if (!notes.length) return 0;
  const unique = new Map(notes.map((n) => [`${n.source_key}/${n.candidate_person_id}`, n]));
  const { data } = await sb.from(NOTES).upsert([...unique.values()], {
    onConflict: "user_id,arbol_id,source_key,candidate_person_id",
    ignoreDuplicates: true
  }).select("id").throwOnError();
  return data.length;
}
async function documentNotes(sb, scope, extraction, tokens) {
  const { data: source } = await sb.from("documentos").select("id,titulo,transcripcion,ocr_texto").match(scopeFilter(scope)).eq("id", extraction.document_id).maybeSingle().throwOnError();
  if (!source) return [];
  const content = [source.transcripcion, source.ocr_texto].filter(Boolean).join("\n");
  return documentMentions(extraction, content).flatMap(
    ({ key, profile: p, excerpt }) => rank(p, tokens).map(({ candidate, score, reasons, conflicts }) => ({
      ...scopeFilter(scope),
      source_person_id: null,
      source_version: extraction.updated_at,
      candidate_version: candidate.revision,
      candidate_person_id: candidate.id,
      document_id: source.id,
      source_key: `doc:${source.id}:${key}`,
      subject_name: p.name,
      candidate_name: candidate.name,
      source_label: source.titulo || "Documento del \xE1rbol",
      excerpt,
      score,
      reasons,
      conflicts,
      model_version: MODEL_VERSION
    }))
  );
}
var pendingFields = "id,document_id,names,dates,relationships,updated_at";
async function loadPending(sb, scope, limit) {
  const filter = scopeFilter(scope);
  const [people, documents] = await Promise.all([
    sb.from(INDEX).select(PEOPLE_FIELDS).match(filter).is("processed_at", null).order("changed_at").order("person_id").limit(limit).throwOnError(),
    sb.from("document_ai_data").select(pendingFields).match(filter).is("neural_processed_at", null).order("updated_at").order("id").limit(3).throwOnError()
  ]);
  return { people: people.data, documents: documents.data };
}
async function batch(sb, scope, cache, limit = 24) {
  const pending = await loadPending(sb, scope, limit);
  if (!pending.people.length && !pending.documents.length) return { processed: 0 };
  const cacheKey = `${scope.userId}/${scope.treeId}`;
  let index = cache?.get(cacheKey);
  if (!index) {
    index = buildIndex(await readTree(sb, scope));
    cache?.clear();
    cache?.set(cacheKey, index);
  }
  const notes = pending.people.flatMap((p) => personNotes(profile(p), index, scope));
  for (const document of pending.documents) notes.push(...await documentNotes(sb, scope, document, index));
  await saveNotes(sb, notes);
  let processed = 0;
  const stamp = (/* @__PURE__ */ new Date()).toISOString();
  if (pending.people.length) {
    const matches = pending.people.map((p) => `and(person_id.eq.${p.person_id},changed_at.eq.${p.changed_at})`).join(",");
    const { data: marked } = await sb.from(INDEX).update({ processed_at: stamp }).match(scopeFilter(scope)).is("processed_at", null).or(matches).select("person_id").throwOnError();
    processed += marked.length;
  }
  for (const doc of pending.documents) {
    const { data: marked } = await sb.from("document_ai_data").update({ neural_processed_at: stamp }).match(scopeFilter(scope)).eq("id", doc.id).eq("updated_at", doc.updated_at).is("neural_processed_at", null).select("id").throwOnError();
    processed += marked.length;
  }
  return { processed };
}
async function scheduledBatch(sb, singlePass = false) {
  const deadline = Date.now() + 38e3;
  const cache = /* @__PURE__ */ new Map();
  let processed = 0;
  do {
    const { data: people } = await sb.from(INDEX).select("user_id,arbol_id").is("processed_at", null).order("changed_at").limit(1).throwOnError();
    const { data: docs } = await sb.from("document_ai_data").select("user_id,arbol_id").is("neural_processed_at", null).not("arbol_id", "is", null).order("updated_at").limit(1).throwOnError();
    const scopes = new Map(
      [...docs, ...people].map((row) => [
        `${row.user_id}/${row.arbol_id}`,
        { userId: row.user_id, treeId: row.arbol_id }
      ])
    );
    if (!scopes.size) break;
    let advanced = 0;
    for (const scope of scopes.values())
      advanced += (await batch(sb, scope, cache, singlePass ? 32 : 24)).processed;
    processed += advanced;
    if (!advanced) break;
  } while (!singlePass && Date.now() < deadline);
  return { processed };
}

// supabase/functions/neural-memory-worker/index.ts
Deno.serve(async (request) => {
  const ticket = request.headers.get("x-geneai-job");
  if (request.method !== "POST" || !ticket || !/^[a-f0-9-]{36}$/.test(ticket))
    return new Response(null, { status: 401 });
  const db = createClient2(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: allowed, error } = await db.rpc("neural_consume_job_ticket", { ticket });
  if (error) return new Response(null, { status: 503 });
  if (allowed !== true) return new Response(null, { status: 401 });
  try {
    const result = await scheduledBatch(db, true);
    const { error: ack } = await db.rpc("neural_finish_job", { ticket, advanced: result.processed > 0 });
    if (ack) throw ack;
    return Response.json(result);
  } catch (error2) {
    const code = error2 && typeof error2 === "object" && "code" in error2 ? String(error2.code) : "WORKER_FAILED";
    console.error("GeneAI memory worker", /^[A-Z0-9_]{1,24}$/.test(code) ? code : "WORKER_FAILED");
    return Response.json({ error: "Trabajo pendiente de reintento" }, { status: 503 });
  }
});

