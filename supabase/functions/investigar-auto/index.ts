// Investigación automática: la IA analiza una persona (o todas) y genera
// hipótesis concretas + sugerencias accionables (no enlaces) para que el
// usuario acepte y se apliquen al árbol.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { pickAiTarget as _pickAiTarget } from "../_shared/userAi.ts";

// === user-AI helper (auto-inyectado) ===
async function _aiFetch(req: Request, body: any) {
  const auth = req.headers.get("Authorization");
  const target = await _pickAiTarget(auth, body?.model);
  const finalBody = { ...body, model: target.model };
  return fetch(target.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${target.key}` },
    body: JSON.stringify(finalBody),
  });
}
// =======================================


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM = `Eres un investigador genealógico experto. Analizas a una persona y su entorno familiar y produces:
1) HIPÓTESIS plausibles (con probabilidad 0-100) sobre datos faltantes, posibles familiares, lugares de origen, migraciones, oficios típicos por época/zona, etc.
2) SUGERENCIAS de cambios concretos al árbol: agregar persona, completar campo, crear relación, crear evento. Cada sugerencia debe incluir el payload exacto listo para aplicar.
3) LAGUNAS detectadas (qué documentos faltan y por qué).

Reglas:
- No inventes hechos como ciertos. Marca todo como hipótesis.
- Razona a partir de patrones históricos (emigración italiana a Sudamérica 1880-1920, costumbres de bautismo, edad de matrimonio, mortalidad infantil, sucesión de nombres, etc.).
- Aprovecha apellidos: variantes ortográficas, origen regional, religión asociada.
- Sé específico y útil: si hay vacío de defunción y tendría >110 años, propón "probable fallecimiento entre X e Y".
- Devuelve siempre la herramienta plan_investigacion_auto.`;

const tool = {
  type: "function",
  function: {
    name: "plan_investigacion_auto",
    description: "Resultado del análisis automático.",
    parameters: {
      type: "object",
      properties: {
        analisis: { type: "string", description: "Resumen breve del análisis (2-4 frases)" },
        lagunas: { type: "array", items: { type: "string" } },
        hipotesis: {
          type: "array",
          items: {
            type: "object",
            properties: {
              titulo: { type: "string" },
              descripcion: { type: "string" },
              probabilidad: { type: "integer", minimum: 0, maximum: 100 },
              argumentos_favor: { type: "string" },
              argumentos_contra: { type: "string" },
              proxima_accion: { type: "string" },
            },
            required: ["titulo", "descripcion", "probabilidad"],
          },
        },
        sugerencias: {
          type: "array",
          items: {
            type: "object",
            properties: {
              tipo: { type: "string", enum: ["nueva_persona", "actualizar_persona", "nueva_relacion", "nuevo_evento", "nuevo_lugar"] },
              titulo: { type: "string" },
              descripcion: { type: "string" },
              confianza: { type: "integer", minimum: 0, maximum: 100 },
              payload: { type: "object", description: "Datos concretos para aplicar el cambio" },
            },
            required: ["tipo", "titulo", "confianza", "payload"],
          },
        },
      },
      required: ["analisis", "hipotesis", "sugerencias"],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY no configurada");

    const auth = req.headers.get("Authorization") ?? "";
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser();
    const user = u.user;
    if (!user) return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { person_id } = await req.json();
    if (!person_id) throw new Error("Falta person_id");

    const { data: persona } = await sb.from("personas").select("*").eq("user_id", user.id).eq("id", person_id).maybeSingle();
    if (!persona) throw new Error("Persona no encontrada");

    const { data: rels } = await sb
      .from("relaciones")
      .select("tipo, personas:pariente_id(nombres, apellidos, nac_fecha, defuncion_fecha, nacionalidad, ocupacion)")
      .eq("user_id", user.id).eq("persona_id", person_id);

    const { data: eventos } = await sb.from("eventos").select("tipo, fecha, fecha_aprox, lugar_original, descripcion")
      .eq("user_id", user.id).eq("persona_id", person_id);

    const ctx = {
      persona: {
        nombres: persona.nombres, apellidos: persona.apellidos, sexo: persona.sexo,
        nac_fecha: persona.nac_fecha, nac_fecha_aprox: persona.nac_fecha_aprox,
        defuncion_fecha: persona.defuncion_fecha, viva: persona.viva,
        nacionalidad: persona.nacionalidad, ocupacion: persona.ocupacion, religion: persona.religion,
        variantes_nombre: persona.variantes_nombre, notas: persona.notas?.slice(0, 800),
      },
      familiares: (rels ?? []).map((r: any) => ({
        tipo: r.tipo, nombre: `${r.personas?.nombres ?? ""} ${r.personas?.apellidos ?? ""}`.trim(),
        nac: r.personas?.nac_fecha, def: r.personas?.defuncion_fecha,
      })),
      eventos: eventos ?? [],
    };

    const aiRes = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Analiza esta persona y su contexto:\n\n${JSON.stringify(ctx, null, 2)}` },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "plan_investigacion_auto" } },
      }),
    });
    if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Límite alcanzado." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Sin créditos de Lovable AI." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiRes.ok) throw new Error(`AI ${aiRes.status}`);

    const j = await aiRes.json();
    const tc = j.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) throw new Error("Sin respuesta estructurada");
    const plan = JSON.parse(tc.function.arguments);

    // Persistir hipótesis
    let hipCreadas = 0;
    for (const h of plan.hipotesis ?? []) {
      const { error } = await sb.from("hipotesis").insert({
        user_id: user.id,
        titulo: h.titulo,
        descripcion: h.descripcion,
        probabilidad: h.probabilidad,
        argumentos_favor: h.argumentos_favor ?? null,
        argumentos_contra: h.argumentos_contra ?? null,
        proxima_accion: h.proxima_accion ?? null,
        personas: [person_id],
        estado: "abierta",
      });
      if (!error) hipCreadas++;
    }

    // Persistir sugerencias accionables
    let sugCreadas = 0;
    for (const s of plan.sugerencias ?? []) {
      const { error } = await sb.from("sugerencias").insert({
        user_id: user.id,
        persona_id: person_id,
        tipo: s.tipo,
        titulo: s.titulo,
        descripcion: s.descripcion ?? null,
        payload: s.payload ?? {},
        confianza: s.confianza,
        origen: "investigar-auto",
        estado: "pendiente",
      });
      if (!error) sugCreadas++;
    }

    await sb.from("actividad").insert({
      user_id: user.id,
      tipo: "ia_investigacion_auto",
      ref_id: person_id, ref_tipo: "persona",
      descripcion: `IA generó ${hipCreadas} hipótesis y ${sugCreadas} sugerencias para ${persona.nombres} ${persona.apellidos}`,
      metadata: { analisis: plan.analisis },
    });

    return new Response(JSON.stringify({
      ok: true, analisis: plan.analisis, lagunas: plan.lagunas ?? [],
      hipotesis_creadas: hipCreadas, sugerencias_creadas: sugCreadas,
      hipotesis: plan.hipotesis ?? [], sugerencias: plan.sugerencias ?? [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("investigar-auto", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
