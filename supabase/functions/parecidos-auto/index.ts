// Calcula automáticamente los parecidos faciales entre familiares (pares con relación) y
// también para la persona indicada vs todos los que tengan rasgos. Recalcula y guarda en tabla `parecidos`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PESOS: Record<string, number> = {
  color_ojos: 18, color_pelo: 12, forma_cara: 14, forma_ojos: 10,
  nariz: 12, boca: 6, menton: 8, frente: 6, cejas: 5, tipo_pelo: 5, complexion: 4,
};

function comparar(a: any, b: any) {
  let total = 0, alc = 0;
  const comunes: any[] = [];
  for (const [k, peso] of Object.entries(PESOS)) {
    const va = a?.[k], vb = b?.[k];
    if (!va || !vb || va === "desconocido" || vb === "desconocido") continue;
    total += peso;
    if (va === vb) { alc += peso; comunes.push({ rasgo: k, valor: String(va), peso }); }
  }
  return { score: total > 0 ? Math.round((alc / total) * 100) : 0, comunes };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const personaId: string | undefined = body.persona_id;
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) throw new Error("Autenticación requerida");

    const token = auth.slice("Bearer ".length);
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    let userId: string | undefined;

    // La llamada interna desde analizar-rostro usa la clave del servidor. Las
    // llamadas de usuario nunca pueden elegir otro user_id desde el cuerpo.
    if (token === serviceRoleKey) {
      userId = body.user_id;
    } else {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
      const { data: { user }, error } = await sb.auth.getUser();
      if (error || !user) throw new Error("Sesión no válida");

      const payloadPart = token.split(".")[1];
      if (!payloadPart) throw new Error("Token no válido");
      const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
      const claims = JSON.parse(atob(padded));
      if (claims.client_id) {
        throw new Error("La conexión de Work solo puede operar mediante el endpoint MCP de GENEAI");
      }
      userId = user?.id;
    }
    if (!userId) throw new Error("user_id requerido");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

    // Para cada persona, tomar el rasgo más reciente
    const { data: rasgos } = await admin.from("rasgos_faciales")
      .select("persona_id, rasgos, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    const last = new Map<string, any>();
    for (const r of rasgos ?? []) if (!last.has(r.persona_id)) last.set(r.persona_id, r.rasgos);

    const ids = personaId ? [personaId] : Array.from(last.keys());
    const otrosIds = Array.from(last.keys());
    let inserted = 0;

    for (const a of ids) {
      if (!last.has(a)) continue;
      for (const b of otrosIds) {
        if (a === b) continue;
        const [x, y] = a < b ? [a, b] : [b, a];
        const { score, comunes } = comparar(last.get(x), last.get(y));
        if (score === 0) continue;
        // upsert por par
        await admin.from("parecidos").delete().eq("user_id", userId).eq("persona_a", x).eq("persona_b", y);
        const { error } = await admin.from("parecidos").insert({
          user_id: userId, persona_a: x, persona_b: y, score,
          rasgos_comunes: comunes, estimacion_genetica: Math.round(score) / 100,
        });
        if (!error) inserted++;
      }
    }

    // Aviso si hay parecidos altos nuevos
    if (personaId && inserted > 0) {
      const { data: top } = await admin.from("parecidos")
        .select("score, persona_a, persona_b")
        .eq("user_id", userId)
        .or(`persona_a.eq.${personaId},persona_b.eq.${personaId}`)
        .gte("score", 70).order("score", { ascending: false }).limit(1);
      if (top && top[0]) {
        await admin.from("notificaciones").insert({
          user_id: userId,
          titulo: "Nuevo parecido familiar detectado",
          mensaje: `Score ${top[0].score}/100`,
          url: "/parecidos",
          tipo: "parecido",
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, calculados: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
    });
  }
});
