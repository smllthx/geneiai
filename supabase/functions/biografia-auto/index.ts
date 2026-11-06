import { rejectUnauthenticated } from "../_shared/auth.ts";
// Genera una biografía narrativa a partir de los datos de la persona y la guarda
// como propuesta revisable. Nunca modifica la ficha genealógica directamente.
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
El contexto puede estar truncado: no afirmes que un dato, pariente o documento no existe sólo porque no esté incluido.
Cuando un dato sea inferido o probable, dilo con expresiones como "probablemente", "según el contexto histórico".
Estructura: 1) introducción (nombre completo, años de vida, lugar), 2) infancia y origen familiar,
3) vida adulta (matrimonio, hijos, ocupación), 4) últimos años y defunción si consta,
5) breve cierre con el legado o lagunas pendientes de investigar.
Largo objetivo: 250-450 palabras. No uses encabezados markdown, solo párrafos.`;

Deno.serve(async (req) => {
  const geneaiAccessRejection = await rejectUnauthenticated(req);
  if (geneaiAccessRejection) return geneaiAccessRejection;
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    // La key de OpenAI la elige _aiFetch.

    const auth = req.headers.get("Authorization") ?? "";
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: u, error: authError } = await sb.auth.getUser();
    if (authError) throw authError;
    const user = u.user;
    if (!user) return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { person_id } = await req.json();
    if (!person_id) throw new Error("Falta person_id");

    const { data: profile, error: profileError } = await sb.from("profiles").select("active_arbol_id").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    const activeTreeId = (profile?.active_arbol_id ?? null) as string | null;
    if (!activeTreeId) throw new Error("Selecciona un archivo familiar antes de generar una biografía.");
    const { data: ownedTree, error: ownedTreeError } = await sb.from("arboles").select("id").eq("id", activeTreeId).eq("user_id", user.id).maybeSingle();
    if (ownedTreeError) throw ownedTreeError;
    if (!ownedTree) throw new Error("El archivo familiar activo no está disponible para esta cuenta.");
    const scopeToActiveTree = (query: any) => query.eq("arbol_id", activeTreeId);

    const { data: persona, error: personError } = await scopeToActiveTree(
      sb.from("personas").select("*").eq("user_id", user.id).eq("id", person_id),
    ).maybeSingle();
    if (personError) throw personError;
    if (!persona) throw new Error("Persona no encontrada");

    const [
      { data: rels, error: relationsError },
      { data: eventos, error: eventsError },
      { data: docs, error: documentsError },
    ] = await Promise.all([
      scopeToActiveTree(sb.from("relaciones")
        .select("tipo, persona_id, pariente_id, personas:pariente_id(nombres, apellidos, nac_fecha, defuncion_fecha)")
        .eq("user_id", user.id).eq("persona_id", person_id)).limit(500),
      scopeToActiveTree(sb.from("eventos").select("tipo, fecha, fecha_aprox, lugar_original, descripcion")
        .eq("user_id", user.id).eq("persona_id", person_id)).order("fecha"),
      scopeToActiveTree(sb.from("documentos").select("titulo, tipo, fecha, resumen")
        .eq("user_id", user.id).contains("personas_mencionadas", [person_id])).limit(20),
    ]);
    if (relationsError) throw relationsError;
    if (eventsError) throw eventsError;
    if (documentsError) throw documentsError;

    const relationEndpointIds = Array.from(new Set(
      (rels ?? []).flatMap((relation: any) => [relation.persona_id, relation.pariente_id]).filter(Boolean),
    ));
    const { data: relationPeople, error: relationPeopleError } = relationEndpointIds.length
      ? await scopeToActiveTree(
        sb.from("personas").select("id").eq("user_id", user.id).in("id", relationEndpointIds),
      )
      : { data: [], error: null };
    if (relationPeopleError) throw relationPeopleError;
    const validRelationPersonIds = new Set((relationPeople ?? []).map((person: any) => person.id));
    const safeRelations = (rels ?? []).filter((relation: any) =>
      validRelationPersonIds.has(relation.persona_id) && validRelationPersonIds.has(relation.pariente_id)
    );

    const ctx = {
      cobertura: {
        modo: "contexto_acotado",
        limite_relaciones: 500,
        limite_documentos: 20,
        permite_concluir_ausencias: false,
      },
      persona: {
        nombres: persona.nombres, apellidos: persona.apellidos, sexo: persona.sexo,
        nac_fecha: persona.nac_fecha, nac_fecha_aprox: persona.nac_fecha_aprox,
        defuncion_fecha: persona.defuncion_fecha, viva: persona.viva,
        nacionalidad: persona.nacionalidad, ocupacion: persona.ocupacion, religion: persona.religion,
      },
      familiares: safeRelations.map((r: any) => ({
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

    const { data: suggestion, error: suggestionError } = await sb.from("sugerencias").insert({
      user_id: user.id,
      arbol_id: persona.arbol_id ?? activeTreeId,
      tipo: "actualizar_persona",
      persona_id: person_id,
      titulo: `Revisar biografía de ${persona.nombres} ${persona.apellidos}`,
      descripcion: "Borrador narrativo generado sólo con los datos disponibles. Revisa fechas, inferencias, omisiones y redacción antes de aplicarlo a las notas.",
      payload: {
        notas: nuevo,
        expected_current_notes: prev,
        generated_biography: bio,
        clasificacion_evidencia: "borrador_ia_no_verificado",
        advertencia: "La biografía es una propuesta editorial; cada afirmación debe contrastarse con las fuentes del archivo.",
      },
      confianza: 0,
      origen: "biografia-auto",
      estado: "pendiente",
    }).select("id").single();
    if (suggestionError) throw suggestionError;

    const { error: activityError } = await sb.from("actividad").insert({
      user_id: user.id, tipo: "ia_biografia",
      ref_id: person_id, ref_tipo: "persona",
      descripcion: `IA preparó una propuesta de biografía para ${persona.nombres} ${persona.apellidos}`,
      metadata: { sugerencia_id: suggestion.id, estado: "pendiente_revision" },
    });
    if (activityError) console.error("No se pudo registrar la actividad", activityError);

    return new Response(JSON.stringify({
      ok: true,
      bio,
      review_required: true,
      applied: false,
      sugerencia_id: suggestion.id,
      review_path: "/sugerencias",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("biografia-auto", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
