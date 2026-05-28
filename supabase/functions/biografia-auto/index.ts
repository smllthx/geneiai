// Genera una biografía narrativa automática a partir de los datos de la persona
// (datos vitales, eventos, relaciones, documentos vinculados) y la guarda en el
// campo `notas` de la persona, conservando lo que ya hubiera tras un separador.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
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


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM = `Eres un biógrafo genealógico. Escribe una biografía en español, en tercera persona,
clara, cálida y respetuosa, basada SOLO en los datos provistos. No inventes hechos.
Cuando un dato sea inferido o probable, dilo con expresiones como "probablemente", "según el contexto histórico".
Estructura: 1) introducción (nombre completo, años de vida, lugar), 2) infancia y origen familiar,
3) vida adulta (matrimonio, hijos, ocupación), 4) últimos años y defunción si consta,
5) breve cierre con el legado o lagunas pendientes de investigar.
Largo objetivo: 250-450 palabras. No uses encabezados markdown, solo párrafos.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    // La key de OpenAI la elige _aiFetch.

    const auth = req.headers.get("Authorization") ?? "";
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser();
    const user = u.user;
    if (!user) return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { person_id } = await req.json();
    if (!person_id) throw new Error("Falta person_id");

    const { data: persona } = await sb.from("personas").select("*").eq("user_id", user.id).eq("id", person_id).maybeSingle();
    if (!persona) throw new Error("Persona no encontrada");

    const [{ data: rels }, { data: eventos }, { data: docs }] = await Promise.all([
      sb.from("relaciones")
        .select("tipo, personas:pariente_id(nombres, apellidos, nac_fecha, defuncion_fecha)")
        .eq("user_id", user.id).eq("persona_id", person_id),
      sb.from("eventos").select("tipo, fecha, fecha_aprox, lugar_original, descripcion")
        .eq("user_id", user.id).eq("persona_id", person_id).order("fecha"),
      sb.from("documentos").select("titulo, tipo, fecha, resumen").contains("personas_mencionadas", [person_id]).limit(20),
    ]);

    const ctx = {
      persona: {
        nombres: persona.nombres, apellidos: persona.apellidos, sexo: persona.sexo,
        nac_fecha: persona.nac_fecha, nac_fecha_aprox: persona.nac_fecha_aprox,
        defuncion_fecha: persona.defuncion_fecha, viva: persona.viva,
        nacionalidad: persona.nacionalidad, ocupacion: persona.ocupacion, religion: persona.religion,
      },
      familiares: (rels ?? []).map((r: any) => ({
        tipo: r.tipo, nombre: `${r.personas?.nombres ?? ""} ${r.personas?.apellidos ?? ""}`.trim(),
        nac: r.personas?.nac_fecha, def: r.personas?.defuncion_fecha,
      })),
      eventos: eventos ?? [],
      documentos: docs ?? [],
    };

    const aiRes = await _aiFetch(req, {
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Escribe la biografía con estos datos:\n\n${JSON.stringify(ctx, null, 2)}` },
      ],
    });
    if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Límite alcanzado" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiRes.ok) throw new Error(`AI ${aiRes.status}`);
    const j = await aiRes.json();
    const bio: string = j.choices?.[0]?.message?.content?.trim() ?? "";
    if (!bio) throw new Error("Sin biografía generada");

    // Conserva las notas previas del usuario; reescribe sólo la sección automática.
    const MARK_START = "<!-- BIO-IA-INICIO -->";
    const MARK_END = "<!-- BIO-IA-FIN -->";
    const prev: string = persona.notas ?? "";
    const stripped = prev.replace(new RegExp(`${MARK_START}[\\s\\S]*?${MARK_END}`, "g"), "").trim();
    const nuevo = `${MARK_START}\n${bio}\n${MARK_END}${stripped ? "\n\n" + stripped : ""}`;

    await sb.from("personas").update({ notas: nuevo }).eq("id", person_id);
    await sb.from("actividad").insert({
      user_id: user.id, tipo: "ia_biografia",
      ref_id: person_id, ref_tipo: "persona",
      descripcion: `IA generó biografía de ${persona.nombres} ${persona.apellidos}`,
      metadata: {},
    });

    return new Response(JSON.stringify({ ok: true, bio }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("biografia-auto", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
