// AI genealogy assistant — agente multi-herramienta que opera sobre el árbol del usuario.
// OpenAI/ChatGPT con tool-calling. Algunas herramientas crean sugerencias, otras ejecutan
// acciones directas (crear persona, relación, lanzar mega-buscador, etc).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { pickAiTarget as _pickAiTarget, prepareEconomyChatBody as _prepareEconomyChatBody } from "../_shared/userAi.ts";

// === user-AI helper (auto-inyectado) ===
async function _aiFetch(req: Request, body: any) {
  const auth = req.headers.get("Authorization");
  const target = await _pickAiTarget(auth, body?.model);
  const finalBody = _prepareEconomyChatBody(body, target.model);
  return fetch(target.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${target.key}` },
    body: JSON.stringify(finalBody),
  });
}
// =======================================


const DEFAULT_MODEL = "openai/gpt-4o-mini";
const FALLBACK_MODEL = "openai/gpt-4o-mini";

const SYSTEM = `Sos el Genealogista IA interno de GENEAI, asistente experto en investigación genealógica conectado a la base de datos del usuario.
Hablás español hispano neutro, claro, breve y accionable.

Capacidades:
- Buscar personas en el árbol activo y también registros importados no vinculados (search_personas, get_persona, list_recent).
- Consultar la estimación de origen por árbol genealógico (get_origin_analysis). Aclará siempre que NO equivale a un test de ADN real.
- CREAR personas, retratos y relaciones DIRECTAMENTE (create_persona, create_relation) cuando el usuario lo pide explícitamente.
- ACTUALIZAR datos (update_persona) cuando hay certeza.
- LANZAR investigaciones automáticas con ChatGPT/OpenAI: mega_search (6 agentes en paralelo), web_search (web libre), agent_investigar (IA).
- DEFINIR la persona principal (set_proband).
- VERIFICAR coherencia (check_coherence).
- SUGERIR cambios sin aplicar (propose_change) cuando hay duda.
- NAVEGAR: devolver intent navigate_to para guiar al usuario a una pantalla.
- Si el usuario quiere subir retratos o fotos, navega a la ficha de persona o a Fotos; el navegador maneja el archivo.

Reglas:
- Si el usuario dice "creá", "agregá", "conectá", "lanzá", "buscá" → ejecutá la herramienta directa.
- Si dudás, pedí confirmación O usá propose_change.
- No inventes datos: distinguí hecho documentado, inferencia probable y dato desconocido.
- Si proponés cambiar, fusionar o borrar datos importantes, pedí confirmación antes de aplicar.
- Confirmá lo realizado en una frase breve, con bullets si hubo varias acciones.
- Nunca inventes UUIDs: si necesitás un id, primero search_personas.`;

type ToolDef = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

const tools: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "search_personas",
      description: "Busca personas del árbol por nombre o apellido (tolerante a tipeos).",
      parameters: {
        type: "object",
        properties: { query: { type: "string" }, limit: { type: "integer", default: 8 } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_persona",
      description: "Devuelve ficha completa con eventos y relaciones.",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_origin_analysis",
      description: "Devuelve la estimación de origen por árbol genealógico guardada para una persona. No es ADN real.",
      parameters: {
        type: "object",
        properties: {
          person_id: { type: "string", description: "uuid de persona. Si falta, usa la persona principal." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_recent",
      description: "Lista personas recientes o totales (útil para orientarse).",
      parameters: { type: "object", properties: { limit: { type: "integer", default: 10 } } },
    },
  },
  {
    type: "function",
    function: {
      name: "create_persona",
      description: "Crea una persona en el árbol del usuario. Devuelve su id.",
      parameters: {
        type: "object",
        properties: {
          nombres: { type: "string" },
          apellidos: { type: "string" },
          sexo: { type: "string", enum: ["masculino", "femenino", "otro"] },
          nac_fecha: { type: "string", description: "YYYY-MM-DD" },
          nac_lugar: { type: "string" },
          defuncion_fecha: { type: "string" },
          ocupacion: { type: "string" },
          notas: { type: "string" },
          viva: { type: "string", enum: ["si", "no", "desconocido"] },
        },
        required: ["nombres", "apellidos"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_persona",
      description: "Actualiza campos de una persona existente.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          changes: { type: "object", description: "campos a actualizar" },
        },
        required: ["id", "changes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_relation",
      description: "Crea una relación entre dos personas (genera ambos lados automáticamente).",
      parameters: {
        type: "object",
        properties: {
          source_id: { type: "string", description: "uuid persona origen" },
          target_id: { type: "string", description: "uuid persona destino" },
          tipo: {
            type: "string",
            enum: ["padre", "madre", "hijo", "conyuge", "hermano", "union_civil", "conviviente", "cohabitante", "padrino", "madrina", "ahijado", "primo", "prima", "socio_negocio", "testigo", "otro"],
            description: "rol de target respecto de source",
          },
        },
        required: ["source_id", "target_id", "tipo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_proband",
      description: "Define la persona principal del árbol (centro por defecto).",
      parameters: { type: "object", properties: { persona_id: { type: "string" } }, required: ["persona_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "mega_search",
      description: "Lanza el mega-buscador (6 agentes en paralelo: FamilySearch avanzado, FamilySearch amplio, web libre, IA general, ascendientes IA, descendientes IA).",
      parameters: { type: "object", properties: { persona_id: { type: "string" } }, required: ["persona_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Búsqueda web libre sin API key (DuckDuckGo + Wikipedia + resumen IA). Crea sugerencias revisables.",
      parameters: { type: "object", properties: { persona_id: { type: "string" } }, required: ["persona_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "agent_investigar",
      description: "Lanza investigación IA (hipótesis, ascendientes o descendientes).",
      parameters: {
        type: "object",
        properties: {
          persona_id: { type: "string" },
          foco: { type: "string", enum: ["general", "ascendientes", "descendientes"], default: "general" },
        },
        required: ["persona_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_coherence",
      description: "Verifica coherencia del árbol (fechas, padres, ciclos). Devuelve recuento por severidad.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate_to",
      description: "Devuelve una intención de navegación para que la UI lleve al usuario a una pantalla.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "ruta absoluta, ej /arbol o /personas/<id>" },
          motivo: { type: "string" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_change",
      description: "Guarda una sugerencia para revisar (no aplica el cambio).",
      parameters: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["nueva_persona", "actualizar_persona", "nueva_relacion", "nuevo_evento", "nueva_fuente", "otro"] },
          titulo: { type: "string" },
          descripcion: { type: "string" },
          persona_id: { type: "string" },
          payload: { type: "object" },
          confianza: { type: "integer", minimum: 0, maximum: 100 },
          origen: { type: "string" },
        },
        required: ["tipo", "titulo", "payload", "confianza"],
      },
    },
  },
];

const norm = (s: string) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const relationNoteFor = (tipo: string) => {
  const labels: Record<string, string> = {
    union_civil: "unión civil",
    conviviente: "convivencia",
    cohabitante: "cohabitación",
    padrino: "padrino",
    madrina: "madrina",
    ahijado: "ahijado/a",
    primo: "primo",
    prima: "prima",
    socio_negocio: "socio/a de negocio",
    testigo: "testigo",
    otro: "otra relación",
  };
  return `relación genealógica: ${labels[tipo] ?? tipo}`;
};

function applyTreeScope(query: any, treeId?: string | null) {
  return treeId ? query.or(`arbol_id.eq.${treeId},arbol_id.is.null`) : query;
}

async function fetchActiveTreeId(sb: ReturnType<typeof createClient>, userId: string) {
  const { data } = await sb.from("profiles").select("active_arbol_id").eq("id", userId).maybeSingle();
  return ((data as any)?.active_arbol_id ?? null) as string | null;
}

async function fetchScopedPeople(
  sb: ReturnType<typeof createClient>,
  userId: string,
  treeId: string | null,
  select = "id,nombres,apellidos,sexo,nac_fecha,defuncion_fecha,nacionalidad,notas,arbol_id,updated_at",
  max = 5000,
) {
  const all: any[] = [];
  const pageSize = 1000;
  for (let from = 0; from < max; from += pageSize) {
    const to = Math.min(from + pageSize - 1, max - 1);
    let query = sb.from("personas")
      .select(select)
      .eq("user_id", userId)
      .order("apellidos", { ascending: true })
      .order("nombres", { ascending: true })
      .range(from, to);
    query = applyTreeScope(query, treeId);
    const { data, error } = await query;
    if (error) throw error;
    const page = data ?? [];
    all.push(...page);
    if (page.length < pageSize) break;
  }
  return all;
}

async function invokeFn(name: string, body: unknown, auth: string) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth, apikey: anon },
    body: JSON.stringify(body),
  });
  return await r.json().catch(() => ({ ok: r.ok }));
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { sb: ReturnType<typeof createClient>; userId: string; auth: string; treeId: string | null; probandId: string | null },
): Promise<unknown> {
  try {
    if (name === "search_personas") {
      const q = norm(String(args.query ?? ""));
      const limit = Math.min(Number(args.limit ?? 8), 20);
      const tokens = q.split(/\s+/).filter(Boolean);
      const people = await fetchScopedPeople(ctx.sb, ctx.userId, ctx.treeId);
      const scored = people
        .map((p: any) => {
          const haystack = norm(`${p.nombres ?? ""} ${p.apellidos ?? ""} ${p.nacionalidad ?? ""} ${p.notas ?? ""}`);
          const score = tokens.reduce((acc, token) => acc + (haystack.includes(token) ? 1 : 0), 0);
          return { p, score };
        })
        .filter(({ score }) => score > 0 || !q)
        .sort((a, b) => b.score - a.score || norm(`${a.p.apellidos} ${a.p.nombres}`).localeCompare(norm(`${b.p.apellidos} ${b.p.nombres}`)))
        .slice(0, limit)
        .map(({ p }) => ({
          id: p.id,
          nombres: p.nombres,
          apellidos: p.apellidos,
          sexo: p.sexo,
          nac_fecha: p.nac_fecha,
          defuncion_fecha: p.defuncion_fecha,
          arbol_id: p.arbol_id ?? null,
        }));
      return { results: scored, total: scored.length };
    }
    if (name === "list_recent") {
      const limit = Math.min(Number(args.limit ?? 10), 30);
      let query = ctx.sb.from("personas")
        .select("id,nombres,apellidos,sexo,nac_fecha")
        .eq("user_id", ctx.userId).order("updated_at", { ascending: false }).limit(limit);
      query = applyTreeScope(query, ctx.treeId);
      const { data } = await query;
      return { results: data ?? [] };
    }
    if (name === "get_origin_analysis") {
      const personId = String(args.person_id ?? ctx.probandId ?? "");
      if (!personId) return { ok: false, error: "No hay persona principal configurada." };
      const { data, error } = await ctx.sb.from("dna_estimates")
        .select("region,porcentaje,rama,fuente,notas,updated_at")
        .eq("user_id", ctx.userId)
        .eq("persona_id", personId)
        .order("porcentaje", { ascending: false });
      if (error) return { ok: false, error: error.message };
      const total = (data ?? []).reduce((sum: number, item: any) => sum + Number(item.porcentaje ?? 0), 0);
      return {
        ok: true,
        person_id: personId,
        methodology: "Estimación por árbol genealógico/documental, ponderada por generación. No equivale a ADN real.",
        total_percentage: total,
        results: data ?? [],
      };
    }
    if (name === "get_persona") {
      const id = String(args.id);
      let eventQuery = ctx.sb.from("eventos")
        .select("tipo,fecha,descripcion,lugar_original,arbol_id")
        .eq("user_id", ctx.userId)
        .eq("persona_id", id);
      let relQuery = ctx.sb.from("relaciones")
        .select("tipo,pariente_id,certeza,notas,arbol_id")
        .eq("user_id", ctx.userId)
        .eq("persona_id", id);
      eventQuery = applyTreeScope(eventQuery, ctx.treeId);
      relQuery = applyTreeScope(relQuery, ctx.treeId);
      const [{ data: p }, { data: ev }, { data: rels }] = await Promise.all([
        ctx.sb.from("personas").select("*").eq("user_id", ctx.userId).eq("id", id).maybeSingle(),
        eventQuery,
        relQuery,
      ]);
      return { persona: p, eventos: ev ?? [], relaciones: rels ?? [] };
    }
    if (name === "create_persona") {
      const row: any = { user_id: ctx.userId, arbol_id: ctx.treeId };
      for (const k of ["nombres", "apellidos", "sexo", "nac_fecha", "nac_lugar", "defuncion_fecha", "ocupacion", "notas", "viva"]) {
        if (args[k] != null && args[k] !== "") row[k] = args[k];
      }
      const { data, error } = await ctx.sb.from("personas").insert(row).select("id").single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, persona_id: data.id };
    }
    if (name === "update_persona") {
      const id = String(args.id);
      const changes = (args.changes as Record<string, unknown>) ?? {};
      const { error } = await ctx.sb.from("personas").update(changes).eq("user_id", ctx.userId).eq("id", id);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }
    if (name === "create_relation") {
      const sourceId = String(args.source_id);
      const targetId = String(args.target_id);
      const tipo = String(args.tipo);
      if (sourceId === targetId) return { ok: false, error: "ids iguales" };
      const { data: src } = await ctx.sb.from("personas").select("sexo").eq("id", sourceId).maybeSingle();
      const unionTypes = new Set(["union_civil", "conviviente", "cohabitante"]);
      const dbTipo = unionTypes.has(tipo) ? "conyuge" : (["padre", "madre", "hijo", "conyuge", "hermano"].includes(tipo) ? tipo : "otro");
      const inverseExtended: Record<string, string> = {
        union_civil: "unión civil",
        conviviente: "conviviente",
        cohabitante: "cohabitante",
        padrino: "ahijado/a",
        madrina: "ahijado/a",
        ahijado: "padrino/madrina",
        primo: "primo",
        prima: "prima",
        socio_negocio: "socio/a de negocio",
        testigo: "testigo",
        otro: "otra relación",
      };
      let pairs: any[] = [];
      if (tipo === "padre" || tipo === "madre") {
        pairs = [
          { persona_id: sourceId, pariente_id: targetId, tipo },
          { persona_id: targetId, pariente_id: sourceId, tipo: "hijo" },
        ];
      } else if (tipo === "hijo") {
        const tipoPadre = (src as any)?.sexo === "femenino" ? "madre" : "padre";
        pairs = [
          { persona_id: targetId, pariente_id: sourceId, tipo: tipoPadre },
          { persona_id: sourceId, pariente_id: targetId, tipo: "hijo" },
        ];
      } else if (tipo === "conyuge" || tipo === "hermano") {
        pairs = [
          { persona_id: sourceId, pariente_id: targetId, tipo },
          { persona_id: targetId, pariente_id: sourceId, tipo },
        ];
      } else if (unionTypes.has(tipo)) {
        pairs = [
          { persona_id: sourceId, pariente_id: targetId, tipo: "conyuge", notas: relationNoteFor(tipo) },
          { persona_id: targetId, pariente_id: sourceId, tipo: "conyuge", notas: relationNoteFor(tipo) },
        ];
      } else {
        pairs = [
          { persona_id: sourceId, pariente_id: targetId, tipo: dbTipo, notas: relationNoteFor(tipo) },
          { persona_id: targetId, pariente_id: sourceId, tipo: "otro", notas: `relación genealógica: ${inverseExtended[tipo] ?? tipo}` },
        ];
      }
      const rows = pairs.map((p) => ({ ...p, user_id: ctx.userId, arbol_id: ctx.treeId, naturaleza: "biologica", certeza: "probable" }));
      const { error } = await ctx.sb.from("relaciones").upsert(rows, { onConflict: "user_id,persona_id,pariente_id,tipo", ignoreDuplicates: true });
      if (error) return { ok: false, error: error.message };
      return { ok: true, creadas: rows.length };
    }
    if (name === "set_proband") {
      const persona_id = String(args.persona_id);
      const { error } = await ctx.sb.from("profiles").update({ proband_id: persona_id, proband_asked: true }).eq("id", ctx.userId);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }
    if (name === "mega_search") {
      const r = await invokeFn("mega-buscador", { persona_id: String(args.persona_id) }, ctx.auth);
      return r;
    }
    if (name === "web_search") {
      const r = await invokeFn("web-search-libre", { persona_id: String(args.persona_id) }, ctx.auth);
      return r;
    }
    if (name === "agent_investigar") {
      const r = await invokeFn("investigar-auto", {
        person_id: String(args.persona_id),
        foco: args.foco ? String(args.foco) : undefined,
      }, ctx.auth);
      return r;
    }
    if (name === "check_coherence") {
      let peopleQuery = ctx.sb.from("personas")
        .select("id,nombres,apellidos,sexo,nac_fecha,defuncion_fecha,arbol_id")
        .eq("user_id", ctx.userId);
      let relQuery = ctx.sb.from("relaciones")
        .select("persona_id,pariente_id,tipo,arbol_id")
        .eq("user_id", ctx.userId);
      peopleQuery = applyTreeScope(peopleQuery, ctx.treeId);
      relQuery = applyTreeScope(relQuery, ctx.treeId);
      const [{ data: personas }, { data: rels }] = await Promise.all([
        peopleQuery,
        relQuery,
      ]);
      // Lightweight checks
      let errores = 0, avisos = 0;
      const byId = new Map((personas ?? []).map((p: any) => [p.id, p]));
      for (const r of (rels ?? [])) {
        const a = byId.get((r as any).persona_id) as any;
        const b = byId.get((r as any).pariente_id) as any;
        if (!a || !b) continue;
        if (((r as any).tipo === "padre" || (r as any).tipo === "madre") && a.nac_fecha && b.nac_fecha) {
          if (new Date(a.nac_fecha) <= new Date(b.nac_fecha)) errores++;
        }
      }
      return { ok: true, errores, avisos, personas: personas?.length ?? 0, relaciones: rels?.length ?? 0 };
    }
    if (name === "navigate_to") {
      return { ok: true, navigate_to: String(args.path), motivo: args.motivo ?? null };
    }
    if (name === "propose_change") {
      const { data, error } = await ctx.sb.from("sugerencias").insert({
        user_id: ctx.userId,
        arbol_id: ctx.treeId,
        tipo: String(args.tipo),
        titulo: String(args.titulo),
        descripcion: args.descripcion ? String(args.descripcion) : null,
        persona_id: args.persona_id ? String(args.persona_id) : null,
        payload: (args.payload as any) ?? {},
        confianza: Math.max(0, Math.min(100, Number(args.confianza ?? 60))),
        origen: args.origen ? String(args.origen) : "asistente-ia",
      }).select("id").single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, sugerencia_id: data.id };
    }
    return { error: `tool desconocida: ${name}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function callModel(model: string, messages: any[], req: Request) {
  const target = await _pickAiTarget(req.headers.get("Authorization"), model);
  const body = _prepareEconomyChatBody({ model, messages, tools, tool_choice: "auto", max_tokens: 700 }, target.model);
  const r = await fetch(target.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${target.key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
  return await r.json();
}



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "no auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await sb.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;
    const body = await req.json();
    const incoming: any[] = Array.isArray(body.messages) ? body.messages : [];
    // Pull tree/proband context to inject
    const { data: prof } = await sb.from("profiles").select("proband_id,active_arbol_id").eq("id", userId).maybeSingle();
    const activeTreeId = ((prof as any)?.active_arbol_id ?? await fetchActiveTreeId(sb, userId)) as string | null;
    const probandId = ((prof as any)?.proband_id ?? null) as string | null;
    let probandCtx = "";
    if (probandId) {
      const { data: p } = await sb.from("personas").select("id,nombres,apellidos").eq("id", probandId).maybeSingle();
      if (p) probandCtx = `\nPersona principal del árbol: ${(p as any).nombres} ${(p as any).apellidos} (id: ${(p as any).id}).`;
    }
    if (activeTreeId) probandCtx += `\nÁrbol activo: ${activeTreeId}. Usá este árbol como contexto principal y no mezcles datos de otros árboles salvo que el usuario lo pida.`;

    const messages: any[] = [{ role: "system", content: SYSTEM + probandCtx }, ...incoming];
    const toolEvents: any[] = [];
    let model = (body.model as string) || DEFAULT_MODEL;
    let usedFallback = false;

    for (let step = 0; step < 8; step++) {
      let resp: any;
      try {
        resp = await callModel(model, messages, req);
      } catch (e) {
        const msg = String((e as Error).message);
        if (!usedFallback && (msg.includes("404") || msg.includes("400"))) {
          model = FALLBACK_MODEL; usedFallback = true;
          resp = await callModel(model, messages, req);
        } else if (msg.includes("429")) {
          return new Response(JSON.stringify({ error: "Límite de uso alcanzado. Esperá un minuto." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } else { throw e; }
      }

      const msg = resp.choices?.[0]?.message;
      if (!msg) break;
      const toolCalls = msg.tool_calls ?? [];
      if (!toolCalls.length) {
        return new Response(JSON.stringify({ content: msg.content ?? "", tool_events: toolEvents, model }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: toolCalls });
      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments ?? "{}"); } catch { /* ignore */ }
        const result = await executeTool(tc.function.name, args, { sb, userId, auth, treeId: activeTreeId, probandId });
        toolEvents.push({ name: tc.function.name, args, result });
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 8000) });
      }
    }

    return new Response(JSON.stringify({ content: "(sin respuesta)", tool_events: toolEvents }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
