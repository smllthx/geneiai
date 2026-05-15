// Cron nocturno: recalcula todos los parecidos por usuario.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const PESOS: Record<string, number> = {
  color_ojos: 18, color_pelo: 12, forma_cara: 14, forma_ojos: 10,
  nariz: 12, boca: 6, menton: 8, frente: 6, cejas: 5, tipo_pelo: 5, complexion: 4,
};
function comparar(a: any, b: any) {
  let total = 0, alc = 0; const comunes: any[] = [];
  for (const [k, p] of Object.entries(PESOS)) {
    const va = a?.[k], vb = b?.[k];
    if (!va || !vb || va === "desconocido" || vb === "desconocido") continue;
    total += p; if (va === vb) { alc += p; comunes.push({ rasgo: k, valor: String(va), peso: p }); }
  }
  return { score: total > 0 ? Math.round((alc / total) * 100) : 0, comunes };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rasgos } = await admin.from("rasgos_faciales").select("user_id, persona_id, rasgos, created_at").order("created_at", { ascending: false });
  // Agrupar por user → ultimo rasgo por persona
  const porUser = new Map<string, Map<string, any>>();
  for (const r of rasgos ?? []) {
    if (!porUser.has(r.user_id)) porUser.set(r.user_id, new Map());
    const m = porUser.get(r.user_id)!;
    if (!m.has(r.persona_id)) m.set(r.persona_id, r.rasgos);
  }
  let total = 0;
  for (const [userId, mapa] of porUser.entries()) {
    const ids = Array.from(mapa.keys());
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j];
        const { score, comunes } = comparar(mapa.get(a), mapa.get(b));
        if (score === 0) continue;
        await admin.from("parecidos").delete().eq("user_id", userId).eq("persona_a", a).eq("persona_b", b);
        const { error } = await admin.from("parecidos").insert({
          user_id: userId, persona_a: a, persona_b: b, score,
          rasgos_comunes: comunes, estimacion_genetica: Math.round(score) / 100,
        });
        if (!error) total++;
      }
    }
  }
  return new Response(JSON.stringify({ ok: true, total }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
