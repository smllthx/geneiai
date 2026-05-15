// AI genealogy assistant — multi-turn chat with tools that operate on the user's tree.
// Uses Lovable AI Gateway (OpenAI-compatible) with tool calling.
// Mutations are NOT applied directly: they are saved as `sugerencias` rows
// that the user reviews and accepts in the UI.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3.1-pro-preview";
const FALLBACK_MODEL = "google/gemini-3-flash-preview";

const SYSTEM = `Sos un asistente experto en genealogía para el "Archivo Familiar" del usuario.
Hablás siempre en español rioplatense, breve y preciso.

Tu trabajo:
- Ayudás a buscar, completar y conectar personas, eventos, lugares y fuentes.
- Cuando proponés un cambio (nueva persona, dato faltante, relación, fuente), llamás a la herramienta "propose_change". NUNCA modificás datos directamente.
- Para buscar gente en el árbol del usuario usás "search_personas" (admite variantes y errores de tipeo).
- Si te falta contexto, preguntá antes de proponer.
- Marcá siempre el nivel de confianza (0-100) y el origen del dato.`;

type ToolDef = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

const tools: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "search_personas",
      description: "Busca personas en el árbol del usuario por nombre/apellido (acepta variantes y errores de tipeo).",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "texto a buscar" }, limit: { type: "integer", default: 8 } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_persona",
      description: "Devuelve la ficha completa de una persona por id, incluyendo eventos y relaciones.",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_change",
      description: "Crea una sugerencia para que el usuario revise y acepte (no modifica datos directamente).",
      parameters: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["nueva_persona", "actualizar_persona", "nueva_relacion", "nuevo_evento", "nueva_fuente", "otro"] },
          titulo: { type: "string" },
          descripcion: { type: "string" },
          persona_id: { type: "string", description: "uuid si aplica" },
          payload: { type: "object", description: "datos concretos del cambio propuesto" },
          confianza: { type: "integer", minimum: 0, maximum: 100 },
          origen: { type: "string", description: "fuente o razonamiento" },
        },
        required: ["tipo", "titulo", "payload", "confianza"],
      },
    },
  },
];

// Strip diacritics + lower for fuzzy match
const norm = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { sb: ReturnType<typeof createClient>; userId: string },
): Promise<unknown> {
  if (name === "search_personas") {
    const q = norm(String(args.query ?? ""));
    const limit = Math.min(Number(args.limit ?? 8), 20);
    const { data, error } = await ctx.sb
      .from("personas")
      .select("id,nombres,apellidos,sexo,nac_fecha,nac_rango_ini,defuncion_fecha,viva,ocupacion")
      .eq("user_id", ctx.userId)
      .limit(200);
    if (error) return { error: error.message };
    const scored = (data ?? [])
      .map((p: any) => {
        const full = norm(`${p.nombres} ${p.apellidos}`);
        const inc = full.includes(q) || q.includes(full);
        return { p, score: inc ? 1 : 0 };
      })
      .filter((x) => x.score > 0)
      .slice(0, limit)
      .map((x) => x.p);
    return { results: scored };
  }
  if (name === "get_persona") {
    const id = String(args.id ?? "");
    const [{ data: persona }, { data: eventos }, { data: rels }] = await Promise.all([
      ctx.sb.from("personas").select("*").eq("user_id", ctx.userId).eq("id", id).maybeSingle(),
      ctx.sb.from("eventos").select("tipo,fecha,fecha_aprox,descripcion,lugar_original").eq("user_id", ctx.userId).eq("persona_id", id),
      ctx.sb.from("relaciones").select("tipo,naturaleza,pariente_id,certeza").eq("user_id", ctx.userId).eq("persona_id", id),
    ]);
    return { persona, eventos: eventos ?? [], relaciones: rels ?? [] };
  }
  if (name === "propose_change") {
    const { data, error } = await ctx.sb.from("sugerencias").insert({
      user_id: ctx.userId,
      tipo: String(args.tipo),
      titulo: String(args.titulo),
      descripcion: args.descripcion ? String(args.descripcion) : null,
      persona_id: args.persona_id ? String(args.persona_id) : null,
      payload: (args.payload as Record<string, unknown>) ?? {},
      confianza: Math.max(0, Math.min(100, Number(args.confianza ?? 60))),
      origen: args.origen ? String(args.origen) : "asistente-ia",
    }).select("id").single();
    if (error) return { error: error.message };
    return { ok: true, sugerencia_id: data.id };
  }
  return { error: `tool desconocida: ${name}` };
}

async function callModel(model: string, messages: any[], key: string) {
  const r = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, tools, tool_choice: "auto" }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`gateway ${r.status}: ${t}`);
  }
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "no auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData, error: uErr } = await sb.auth.getUser();
    if (uErr || !userData.user) {
      return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const incoming: { role: string; content: string }[] = Array.isArray(body.messages) ? body.messages : [];

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY no configurada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const messages: any[] = [{ role: "system", content: SYSTEM }, ...incoming];
    const toolEvents: { name: string; args: any; result: any }[] = [];

    let model = body.model && typeof body.model === "string" ? body.model : DEFAULT_MODEL;
    let usedFallback = false;

    for (let step = 0; step < 6; step++) {
      let resp: any;
      try {
        resp = await callModel(model, messages, key);
      } catch (e) {
        const msg = String((e as Error).message);
        if (!usedFallback && (msg.includes("404") || msg.includes("400"))) {
          model = FALLBACK_MODEL;
          usedFallback = true;
          resp = await callModel(model, messages, key);
        } else if (msg.includes("429")) {
          return new Response(JSON.stringify({ error: "Límite de uso alcanzado. Esperá un minuto." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } else if (msg.includes("402")) {
          return new Response(JSON.stringify({ error: "Sin créditos en Lovable AI. Agregá créditos en Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } else {
          throw e;
        }
      }

      const choice = resp.choices?.[0];
      const msg = choice?.message;
      if (!msg) break;

      const toolCalls = msg.tool_calls ?? [];
      if (!toolCalls.length) {
        return new Response(
          JSON.stringify({ content: msg.content ?? "", tool_events: toolEvents, model }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: toolCalls });
      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments ?? "{}"); } catch (_) { /* ignore */ }
        const result = await executeTool(tc.function.name, args, { sb, userId });
        toolEvents.push({ name: tc.function.name, args, result });
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
      }
    }

    return new Response(JSON.stringify({ content: "(sin respuesta)", tool_events: toolEvents }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
