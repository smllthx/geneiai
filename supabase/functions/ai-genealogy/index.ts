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

const SYSTEM = `Sos GENAIA, asistente experto en genealogía del Archivo Familiar del usuario.
Hablás español hispano neutro, claro, breve y accionable.

Capacidades:
- Buscar personas (search_personas, get_persona, list_recent).
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
  ctx: { sb: ReturnType<typeof createClient>; userId: string; auth: string },
): Promise<unknown> {
  try {
    if (name === "search_personas") {
      const q = norm(String(args.query ?? ""));
      const limit = Math.min(Number(args.limit ?? 8), 20);
      const { data } = await ctx.sb.from("personas")
        .select("id,nombres,apellidos,sexo,nac_fecha,defuncion_fecha")
        .eq("user_id", ctx.userId).limit(200);
      const scored = (data ?? []).filter((p: any) =>
        norm(`${p.nombres} ${p.apellidos}`).includes(q)).slice(0, limit);
      return { results: scored, total: scored.length };
    }
    if (name === "list_recent") {
      const limit = Math.min(Number(args.limit ?? 10), 30);
      const { data } = await ctx.sb.from("personas")
        .select("id,nombres,apellidos,sexo,nac_fecha")
        .eq("user_id", ctx.userId).order("created_at", { ascending: false }).limit(limit);
      return { results: data ?? [] };
    }
    if (name === "get_persona") {
      const id = String(args.id);
      const [{ data: p }, { data: ev }, { data: rels }] = await Promise.all([
        ctx.sb.from("personas").select("*").eq("user_id", ctx.userId).eq("id", id).maybeSingle(),
        ctx.sb.from("eventos").select("tipo,fecha,descripcion,lugar_original").eq("user_id", ctx.userId).eq("persona_id", id),
        ctx.sb.from("relaciones").select("tipo,pariente_id,certeza").eq("user_id", ctx.userId).eq("persona_id", id),
      ]);
      return { persona: p, eventos: ev ?? [], relaciones: rels ?? [] };
    }
    if (name === "create_persona") {
      const row: any = { user_id: ctx.userId };
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
      const extendedLabels: Record<string, string> = {
        union_civil: "unión civil",
        conviviente: "conviviente",
        cohabitante: "cohabitante",
        padrino: "padrino",
        madrina: "madrina",
        ahijado: "ahijado/a",
        primo: "primo",
        prima: "prima",
        socio_negocio: "socio/a de negocio",
        testigo: "testigo",
        otro: "otra relación",
      };
      const dbTipo = ["padre", "madre", "hijo", "conyuge", "hermano"].includes(tipo) ? tipo : "otro";
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
      } else {
        pairs = [
          { persona_id: sourceId, pariente_id: targetId, tipo: dbTipo, notas: `relación genealógica: ${extendedLabels[tipo] ?? tipo}` },
          { persona_id: targetId, pariente_id: sourceId, tipo: "otro", notas: `relación genealógica: ${inverseExtended[tipo] ?? extendedLabels[tipo] ?? tipo}` },
        ];
      }
      const rows = pairs.map((p) => ({ ...p, user_id: ctx.userId, naturaleza: "biologica", certeza: "probable" }));
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
      const [{ data: personas }, { data: rels }] = await Promise.all([
        ctx.sb.from("personas").select("id,nombres,apellidos,sexo,nac_fecha,defuncion_fecha").eq("user_id", ctx.userId),
        ctx.sb.from("relaciones").select("persona_id,pariente_id,tipo").eq("user_id", ctx.userId),
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
    // Pull proband context to inject
    const { data: prof } = await sb.from("profiles").select("proband_id").eq("id", userId).maybeSingle();
    let probandCtx = "";
    if ((prof as any)?.proband_id) {
      const { data: p } = await sb.from("personas").select("id,nombres,apellidos").eq("id", (prof as any).proband_id).maybeSingle();
      if (p) probandCtx = `\nPersona principal del árbol: ${(p as any).nombres} ${(p as any).apellidos} (id: ${(p as any).id}).`;
    }

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
        const result = await executeTool(tc.function.name, args, { sb, userId, auth });
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
