// Analiza una foto y extrae rasgos faciales estructurados con Lovable AI (Gemini vision).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCHEMA = {
  type: "object",
  properties: {
    forma_cara: { type: "string", enum: ["ovalada","redonda","cuadrada","alargada","triangular","corazon","desconocido"] },
    color_ojos: { type: "string", enum: ["marrones","claros","verdes","azules","grises","desconocido"] },
    forma_ojos: { type: "string", enum: ["almendrados","redondos","rasgados","caidos","desconocido"] },
    color_pelo: { type: "string", enum: ["negro","castano","rubio","pelirrojo","canoso","blanco","desconocido"] },
    tipo_pelo: { type: "string", enum: ["liso","ondulado","rizado","calvo","desconocido"] },
    nariz: { type: "string", enum: ["recta","aguilena","respingona","ancha","fina","desconocido"] },
    boca: { type: "string", enum: ["fina","carnosa","ancha","pequena","desconocido"] },
    menton: { type: "string", enum: ["prominente","retraido","redondo","cuadrado","desconocido"] },
    frente: { type: "string", enum: ["ancha","estrecha","alta","baja","desconocido"] },
    cejas: { type: "string", enum: ["pobladas","finas","rectas","arqueadas","desconocido"] },
    complexion: { type: "string", enum: ["delgada","media","robusta","desconocido"] },
    edad_aprox: { type: "integer" },
    sexo_aparente: { type: "string", enum: ["masculino","femenino","desconocido"] },
    rasgos_distintivos: { type: "array", items: { type: "string" } },
    resumen: { type: "string" },
  },
  required: ["forma_cara","color_ojos","color_pelo","resumen"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("No autenticado");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión inválida");

    const { persona_id, foto_url, foto_id } = await req.json();
    if (!persona_id || !foto_url) throw new Error("Faltan persona_id o foto_url");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY no configurado");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: "Eres un analista de rasgos faciales para genealogía. Observa la foto y describe rasgos visibles usando exactamente el esquema. Si no puedes determinar algo, usa 'desconocido'. No inventes." },
          { role: "user", content: [
            { type: "text", text: "Analiza esta foto y extrae los rasgos faciales en JSON estricto." },
            { type: "image_url", image_url: { url: foto_url } },
          ]},
        ],
        tools: [{ type: "function", function: { name: "guardar_rasgos", description: "Guarda los rasgos faciales", parameters: SCHEMA } }],
        tool_choice: { type: "function", function: { name: "guardar_rasgos" } },
      }),
    });

    if (res.status === 429) throw new Error("Límite de uso alcanzado (429). Intenta más tarde.");
    if (res.status === 402) throw new Error("Créditos agotados. Añade créditos en Lovable.");
    if (!res.ok) throw new Error(`AI gateway error ${res.status}: ${await res.text()}`);

    const json = await res.json();
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const rasgos = args ? JSON.parse(args) : {};

    const { data: saved, error } = await supabase.from("rasgos_faciales").insert({
      user_id: user.id, persona_id, foto_id: foto_id ?? null, foto_url,
      rasgos, resumen: rasgos.resumen ?? null, modelo: "google/gemini-2.5-pro",
    }).select().single();
    if (error) throw error;

    // Disparar recálculo de parecidos para esta persona (best-effort, sin esperar)
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/parecidos-auto`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ persona_id, user_id: user.id }),
      });
    } catch {}

    return new Response(JSON.stringify({ ok: true, rasgos: saved }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
