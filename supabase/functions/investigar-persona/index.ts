// Investigar persona — agente de IA que recibe una persona + sus parientes,
// genera hipótesis de investigación, queries listas para FamilySearch / MyHeritage /
// Geneanet / Google Books / archivos parroquiales, y crea tareas de investigación.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

interface InvestigarBody { person_id: string }

const SYSTEM = `Eres un asistente de investigación genealógica. Recibes una persona y sus parientes conocidos.
Tu tarea: proponer un plan de investigación CONCRETO y verificable, sin inventar hechos.

Reglas:
- Nunca afirmes hechos no comprobados. Habla de "probable", "buscar", "verificar".
- Genera queries específicas para cada plataforma (FamilySearch, MyHeritage, Geneanet, Google Books, hemerotecas).
- Identifica lagunas (ej. falta acta de bautismo, falta defunción, falta migración).
- Si hay variantes ortográficas plausibles del apellido o nombre (ej. Sanguineti/Sanguinetti, Giovanni/Juan), inclúyelas.
- Cita siempre el repositorio o tipo de archivo a consultar.
Devuelve estrictamente un JSON con la herramienta plan_investigacion.`;

function buildSearchUrl(plataforma: string, query: string): string {
  const q = encodeURIComponent(query);
  switch (plataforma.toLowerCase()) {
    case "familysearch":
      return `https://www.familysearch.org/search/record/results?q.givenName=&q.surname=&q.anyPlace=&q.anyDate=&q.anyKeyword=${q}`;
    case "myheritage":
      return `https://www.myheritage.es/research?formId=master&formMode=&qname=Name+fn.${q}`;
    case "geneanet":
      return `https://en.geneanet.org/genealogy/?type=geneanet&country=&place=&name=${q}`;
    case "google_books":
      return `https://www.google.com/search?tbm=bks&q=${q}`;
    case "google":
      return `https://www.google.com/search?q=${q}`;
    case "hemeroteca":
      return `https://www.google.com/search?q=${q}+site%3Ahemerotecadigital.bne.es`;
    default:
      return `https://www.google.com/search?q=${q}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { person_id } = (await req.json()) as InvestigarBody;
    if (!person_id) throw new Error("Falta person_id");

    // Fetch person + relatives
    const { data: persona, error: pErr } = await supabase.from("personas").select("*").eq("id", person_id).maybeSingle();
    if (pErr || !persona) throw new Error("Persona no encontrada");

    const { data: rels } = await supabase
      .from("relaciones")
      .select("tipo, pariente_id, personas:pariente_id(nombres, apellidos, nac_fecha, defuncion_fecha, nacionalidad)")
      .eq("persona_id", person_id);

    const personaCtx = {
      nombres: persona.nombres,
      apellidos: persona.apellidos,
      sexo: persona.sexo,
      nac_fecha: persona.nac_fecha,
      nac_lugar: persona.nac_lugar_id,
      defuncion_fecha: persona.defuncion_fecha,
      nacionalidad: persona.nacionalidad,
      ocupacion: persona.ocupacion,
      religion: persona.religion,
      variantes_nombre: persona.variantes_nombre,
      notas: persona.notas?.slice(0, 500),
    };
    const familia = (rels ?? []).map((r: any) => ({
      tipo: r.tipo,
      nombre: `${r.personas?.nombres ?? ""} ${r.personas?.apellidos ?? ""}`.trim(),
      nac: r.personas?.nac_fecha,
      def: r.personas?.defuncion_fecha,
      nacionalidad: r.personas?.nacionalidad,
    }));

    const userPrompt = `Persona objetivo:\n${JSON.stringify(personaCtx, null, 2)}\n\nFamiliares conocidos:\n${JSON.stringify(familia, null, 2)}`;

    const aiRes = await _aiFetch(req, {
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "plan_investigacion",
            description: "Plan de investigación genealógica para esta persona",
            parameters: {
              type: "object",
              properties: {
                lagunas: { type: "array", items: { type: "string" } },
                hipotesis: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      titulo: { type: "string" },
                      descripcion: { type: "string" },
                      probabilidad: { type: "integer", minimum: 0, maximum: 100 },
                    },
                    required: ["titulo", "descripcion", "probabilidad"],
                  },
                },
                busquedas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      plataforma: { type: "string", enum: ["familysearch", "myheritage", "geneanet", "google_books", "google", "hemeroteca"] },
                      objetivo: { type: "string" },
                      query: { type: "string" },
                    },
                    required: ["plataforma", "objetivo", "query"],
                  },
                },
                tareas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      tipo: { type: "string", enum: ["buscar_nacimiento", "buscar_bautismo", "buscar_matrimonio", "buscar_defuncion", "buscar_pasajeros", "buscar_partida", "buscar_censo", "otro"] },
                      descripcion: { type: "string" },
                    },
                    required: ["tipo", "descripcion"],
                  },
                },
              },
              required: ["lagunas", "hipotesis", "busquedas", "tareas"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "plan_investigacion" } },
    });

    if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Límite de requests alcanzado, intentá en un minuto." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("OpenAI error", aiRes.status, t);
      throw new Error(`OpenAI ${aiRes.status}`);
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Sin respuesta estructurada del modelo");
    const plan = JSON.parse(toolCall.function.arguments);

    // Persist búsquedas externas
    const busquedasRows = (plan.busquedas ?? []).map((b: any) => ({
      user_id: user.id,
      persona_id: person_id,
      plataforma: b.plataforma,
      objetivo: b.objetivo,
      query: b.query,
      url: buildSearchUrl(b.plataforma, b.query),
    }));
    if (busquedasRows.length) await supabase.from("busquedas_externas").insert(busquedasRows);

    // Persist tareas
    const tareasRows = (plan.tareas ?? []).map((t: any) => ({
      user_id: user.id,
      person_id,
      tipo: t.tipo,
      descripcion: t.descripcion,
      estado: "pendiente",
    }));
    if (tareasRows.length) await supabase.from("research_tasks").insert(tareasRows);

    // Persist hipótesis
    const hipotesisRows = (plan.hipotesis ?? []).map((h: any) => ({
      user_id: user.id,
      titulo: h.titulo,
      descripcion: h.descripcion,
      personas: [person_id],
      probabilidad: h.probabilidad,
      estado: "abierta",
    }));
    if (hipotesisRows.length) await supabase.from("hipotesis").insert(hipotesisRows);

    return new Response(JSON.stringify({
      lagunas: plan.lagunas ?? [],
      hipotesis_creadas: hipotesisRows.length,
      busquedas_creadas: busquedasRows.length,
      tareas_creadas: tareasRows.length,
      plan,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("investigar-persona error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
