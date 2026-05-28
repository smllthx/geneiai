// Analiza una foto subida y extrae contexto: año estimado, lugar, clase social,
// edades, relaciones aparentes, nacionalidades, descripción. Actualiza la fila `fotos`.
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


const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCHEMA = {
  type: "object",
  properties: {
    titulo_sugerido: { type: "string" },
    descripcion: { type: "string", description: "Descripción narrativa breve de la escena, personas y vestimenta." },
    ano_estimado: { type: "integer", description: "Año aproximado de la foto (1700-2025)." },
    decada_estimada: { type: "string", description: "Ej. '1920s'." },
    lugar_estimado: { type: "string", description: "Ciudad/país probable o región." },
    nacionalidades_probables: { type: "array", items: { type: "string" } },
    clase_social: { type: "string", enum: ["humilde", "trabajadora", "media", "media-alta", "alta", "aristocracia", "religiosa", "militar", "desconocida"] },
    cantidad_personas: { type: "integer" },
    edades_aproximadas: { type: "array", items: { type: "integer" } },
    relaciones_aparentes: { type: "string", description: "Ej. 'pareja con tres hijos', 'grupo de hermanos', 'retrato individual'." },
    tipo_foto: { type: "string", enum: ["retrato", "familiar", "boda", "religiosa", "militar", "paisaje", "documento", "grupo", "otra"] },
    etiquetas: { type: "array", items: { type: "string" } },
  },
  required: ["descripcion", "tipo_foto"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("No autenticado");
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supa.auth.getUser();
    if (!user) throw new Error("Sesión inválida");

    const { foto_id, foto_url } = await req.json();
    if (!foto_id || !foto_url) throw new Error("Faltan foto_id o foto_url");

    const res = await _aiFetch(req, {
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: "Eres un historiador y archivista experto en fotografía familiar de los siglos XVIII a XXI. Observa la imagen y deduce contexto histórico (año, lugar, clase social, nacionalidad probable, edades, relaciones) usando indicios de vestimenta, mobiliario, tipo de papel, pose y composición. Si no puedes determinar algo, omítelo. Nunca inventes nombres." },
          { role: "user", content: [
            { type: "text", text: "Analiza esta foto familiar y devuelve el JSON estricto del esquema." },
            { type: "image_url", image_url: { url: foto_url } },
          ]},
        ],
        tools: [{ type: "function", function: { name: "guardar_contexto", description: "Guarda el análisis contextual", parameters: SCHEMA } }],
        tool_choice: { type: "function", function: { name: "guardar_contexto" } },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI error ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : null;
    if (!args) throw new Error("Sin resultado del modelo");

    // Construir descripcion enriquecida y patch a la fila de fotos
    const lineas: string[] = [];
    if (args.descripcion) lineas.push(args.descripcion);
    const meta: string[] = [];
    if (args.tipo_foto) meta.push(`tipo: ${args.tipo_foto}`);
    if (args.clase_social) meta.push(`clase: ${args.clase_social}`);
    if (args.cantidad_personas != null) meta.push(`personas: ${args.cantidad_personas}`);
    if (args.relaciones_aparentes) meta.push(args.relaciones_aparentes);
    if (args.edades_aproximadas?.length) meta.push(`edades ~ ${args.edades_aproximadas.join(", ")}`);
    if (args.nacionalidades_probables?.length) meta.push(`origen probable: ${args.nacionalidades_probables.join(", ")}`);
    if (meta.length) lineas.push("— " + meta.join(" · "));
    if (args.etiquetas?.length) lineas.push("Etiquetas: " + args.etiquetas.join(", "));

    const patch: any = { descripcion: lineas.join("\n"), analisis_ia: args };
    if (args.titulo_sugerido) patch.titulo = args.titulo_sugerido;
    if (args.ano_estimado) patch.fecha_aprox = String(args.ano_estimado);
    else if (args.decada_estimada) patch.fecha_aprox = args.decada_estimada;
    if (args.lugar_estimado) patch.lugar_estimado = args.lugar_estimado;

    // Persistir tolerando columnas inexistentes: probamos primero el patch completo, si falla quitamos extras.
    let { error: upErr } = await supa.from("fotos").update(patch).eq("id", foto_id);
    if (upErr) {
      delete patch.analisis_ia;
      delete patch.lugar_estimado;
      ({ error: upErr } = await supa.from("fotos").update(patch).eq("id", foto_id));
      if (upErr) throw upErr;
    }

    return new Response(JSON.stringify({ ok: true, analisis: args }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
