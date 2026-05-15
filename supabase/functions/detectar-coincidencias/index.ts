// Detecta pares de personas potencialmente duplicadas y los inserta en `coincidencias`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function norm(s: string | null | undefined) {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
}
function lev(a: string, b: string) {
  const m = a.length, n = b.length;
  if (!m || !n) return Math.max(m, n);
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
  return dp[m][n];
}
const sim = (a: string, b: string) => 1 - lev(a, b) / Math.max(a.length, b.length, 1);
const yearOf = (d: string | null, ri: number | null) => d ? new Date(d).getUTCFullYear() : ri;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("No autenticado");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión inválida");

    const { data: personas } = await supabase.from("personas")
      .select("id,nombres,apellidos,nac_fecha,nac_rango_ini,defuncion_fecha,sexo,nac_lugar_id");
    const ps = personas ?? [];

    // Existing pairs to avoid duplicates
    const { data: existing } = await supabase.from("coincidencias")
      .select("ref_a,ref_b").eq("tipo", "persona");
    const seen = new Set<string>((existing ?? []).map((e: any) => {
      const [a, b] = [e.ref_a, e.ref_b].sort();
      return `${a}|${b}`;
    }));

    const found: any[] = [];
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];
        const ap = norm(a.apellidos), bp = norm(b.apellidos);
        const an = norm(a.nombres), bn = norm(b.nombres);
        const simAp = sim(ap, bp);
        const simNo = sim(an, bn);
        if (simAp < 0.7 || simNo < 0.55) continue;

        const yA = yearOf(a.nac_fecha, a.nac_rango_ini);
        const yB = yearOf(b.nac_fecha, b.nac_rango_ini);
        const diffY = yA && yB ? Math.abs(yA - yB) : null;
        const cercaFecha = diffY !== null && diffY <= 3;
        const mismoLugar = a.nac_lugar_id && a.nac_lugar_id === b.nac_lugar_id;
        const mismoSexo = a.sexo && a.sexo === b.sexo;

        let score = Math.round(simAp * 35 + simNo * 25);
        const razones: string[] = [
          `Apellido ${Math.round(simAp * 100)}% similar`,
          `Nombre ${Math.round(simNo * 100)}% similar`,
        ];
        if (cercaFecha) { score += 25; razones.push(`Año cercano (±${diffY})`); }
        else if (diffY !== null && diffY > 30) { score -= 15; razones.push(`Años muy distintos (${diffY})`); }
        if (mismoLugar) { score += 10; razones.push("Mismo lugar de nacimiento"); }
        if (mismoSexo) { score += 5; razones.push("Mismo sexo"); }
        score = Math.max(0, Math.min(100, score));
        if (score < 50) continue;

        const [refA, refB] = [a.id, b.id].sort();
        const key = `${refA}|${refB}`;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({ user_id: user.id, tipo: "persona", ref_a: refA, ref_b: refB, score, razones });
      }
    }

    let creadas = 0;
    if (found.length) {
      const { error } = await supabase.from("coincidencias").insert(found);
      if (!error) creadas = found.length;
    }

    await supabase.from("actividad").insert({
      user_id: user.id, tipo: "deteccion",
      descripcion: `Detección de coincidencias: ${creadas} nuevas (${ps.length} personas analizadas)`,
      metadata: { creadas, analizadas: ps.length },
    });

    return new Response(JSON.stringify({ creadas, analizadas: ps.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
