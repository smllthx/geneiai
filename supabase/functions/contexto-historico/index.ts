import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: ures } = await supabase.auth.getUser();
    const user = ures?.user;
    if (!user) return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { person_id } = await req.json();
    if (!person_id) throw new Error("Falta person_id");

    const { data: persona } = await supabase.from("personas").select("*").eq("id", person_id).maybeSingle();
    if (!persona) throw new Error("Persona no encontrada");

    // Lugares conocidos
    const lugarIds = [persona.nac_lugar_id, persona.bautismo_lugar_id, persona.matrimonio_lugar_id, persona.defuncion_lugar_id].filter(Boolean);
    const { data: lugares } = lugarIds.length
      ? await supabase.from("lugares").select("*").in("id", lugarIds as string[])
      : { data: [] as any[] };

    const ctx = {
      nombre: `${persona.nombres} ${persona.apellidos}`.trim(),
      sexo: persona.sexo,
      nacionalidad: persona.nacionalidad,
      religion: persona.religion,
      ocupacion: persona.ocupacion,
      nacimiento: persona.nac_fecha ?? persona.nac_fecha_aprox ?? (persona.nac_rango_ini ? `c.${persona.nac_rango_ini}-${persona.nac_rango_fin ?? ""}` : null),
      defuncion: persona.defuncion_fecha,
      lugares: (lugares ?? []).map((l: any) => [l.parroquia, l.ciudad, l.provincia, l.region, l.pais].filter(Boolean).join(", ")),
      notas: persona.notas,
    };

    const prompt = `Sos un historiador genealogista. A partir de los datos siguientes, generá entre 3 y 6 HIPÓTESIS contextuales sobre hechos, situaciones y contextos históricos que probablemente hayan afectado la vida de esta persona (guerras, migraciones masivas, epidemias, hambrunas, contexto económico/político/religioso del lugar y la época, leyes que la pudieron afectar, rutas migratorias típicas, oficios comunes en la región).

Cada hipótesis debe ser razonable, específica al lugar y a la época, y JAMÁS presentarse como hecho comprobado.

DATOS:
${JSON.stringify(ctx, null, 2)}

Devolvé estrictamente JSON válido con esta forma:
{
  "hipotesis": [
    {
      "titulo": "string corto",
      "descripcion": "2-4 oraciones explicando el contexto y por qué es relevante para esta persona",
      "argumentos_favor": "qué evidencia indirecta apoya esta hipótesis",
      "argumentos_contra": "qué la haría improbable",
      "probabilidad": 1-100,
      "proxima_accion": "qué fuente buscar para confirmarla o descartarla"
    }
  ]
}`;

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY no configurada");
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Devolvés solo JSON válido. Nada de texto antes o después." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!r.ok) {
      if (r.status === 429) throw new Error("Límite de uso alcanzado en Lovable AI. Esperá un minuto.");
      if (r.status === 402) throw new Error("Sin créditos en Lovable AI. Agregá créditos en Workspace → Usage.");
      throw new Error(`AI error ${r.status}: ${await r.text()}`);
    }
    const data = await r.json();
    let content: string = data.choices?.[0]?.message?.content ?? "{}";
    content = content.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { hipotesis: [] }; }

    const items = Array.isArray(parsed.hipotesis) ? parsed.hipotesis : [];
    const inserts = items.map((h: any) => ({
      user_id: user.id,
      titulo: `[Contexto] ${String(h.titulo ?? "Hipótesis contextual").slice(0, 200)}`,
      descripcion: String(h.descripcion ?? ""),
      argumentos_favor: String(h.argumentos_favor ?? ""),
      argumentos_contra: String(h.argumentos_contra ?? ""),
      probabilidad: Math.max(1, Math.min(100, Number(h.probabilidad ?? 50))),
      proxima_accion: String(h.proxima_accion ?? ""),
      personas: [person_id],
      estado: "abierta" as const,
    }));

    if (inserts.length > 0) {
      await supabase.from("hipotesis").insert(inserts);
    }

    return new Response(JSON.stringify({ ok: true, creadas: inserts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
