// Cron nocturno: analiza fotos nuevas (sin rasgos extraídos aún) en lote.
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
};

const SCHEMA = {
  type: "object",
  properties: {
    forma_cara: { type: "string" }, color_ojos: { type: "string" }, forma_ojos: { type: "string" },
    color_pelo: { type: "string" }, tipo_pelo: { type: "string" }, nariz: { type: "string" },
    boca: { type: "string" }, menton: { type: "string" }, frente: { type: "string" },
    cejas: { type: "string" }, complexion: { type: "string" }, edad_aprox: { type: "integer" },
    sexo_aparente: { type: "string" }, resumen: { type: "string" },
  },
  required: ["forma_cara", "color_ojos", "color_pelo", "resumen"],
};

async function analizar(req: Request, foto_url: string) {
  const res = await _aiFetch(req, {
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: "Eres analista de rasgos faciales para genealogía. Usa 'desconocido' si no puedes determinar algo." },
        { role: "user", content: [
          { type: "text", text: "Extrae rasgos en JSON estricto." },
          { type: "image_url", image_url: { url: foto_url } },
        ]},
      ],
      tools: [{ type: "function", function: { name: "guardar_rasgos", parameters: SCHEMA } }],
      tool_choice: { type: "function", function: { name: "guardar_rasgos" } },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  return args ? JSON.parse(args) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Selecciona fotos sin rasgos vinculados aún, con personas etiquetadas, máx 40/noche
    const { data: fotos } = await supabase
      .from("fotos")
      .select("id,url,user_id,personas_ids,created_at")
      .not("personas_ids", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!fotos?.length) return new Response(JSON.stringify({ ok: true, procesadas: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const fotoIds = fotos.map(f => f.id);
    const { data: existentes } = await supabase.from("rasgos_faciales").select("foto_id").in("foto_id", fotoIds);
    const yaProcesadas = new Set((existentes ?? []).map((r: any) => r.foto_id));

    const pendientes = fotos.filter(f => !yaProcesadas.has(f.id) && (f.personas_ids?.length ?? 0) > 0).slice(0, 40);
    let ok = 0;
    for (const f of pendientes) {
      const rasgos = await analizar(req, f.url);
      if (!rasgos) continue;
      for (const persona_id of f.personas_ids) {
        await supabase.from("rasgos_faciales").insert({
          user_id: f.user_id, persona_id, foto_id: f.id, foto_url: f.url,
          rasgos, resumen: rasgos.resumen ?? null, modelo: "openai/gpt-4o-mini",
        });
      }
      ok++;
    }
    return new Response(JSON.stringify({ ok: true, procesadas: ok, candidatas: pendientes.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
