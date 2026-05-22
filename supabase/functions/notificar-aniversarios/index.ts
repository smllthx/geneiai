// Genera notificaciones de cumpleaños, aniversarios de bautismo, matrimonio,
// defunción y entierro para los próximos N días. Idempotente por día.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function mmdd(d: string | null | undefined) {
  if (!d) return null;
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[2]}-${m[3]}` : null;
}
function yearOf(d: string | null | undefined) {
  if (!d) return null;
  const m = String(d).match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "no auth" }), { status: 401, headers: corsHeaders });

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: u } = await sb.auth.getUser();
    const userId = u?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "no user" }), { status: 401, headers: corsHeaders });

    const today = new Date();
    const lookahead = 14; // próximos 14 días
    const todayY = today.getFullYear();

    const { data: personas } = await sb.from("personas")
      .select("id, nombres, apellidos, nac_fecha, defuncion_fecha, bautismo_fecha, matrimonio_fecha, entierro_fecha, viva")
      .eq("user_id", userId).limit(5000);

    type Item = { tipo: string; titulo: string; mensaje: string; persona_id: string; key: string };
    const items: Item[] = [];

    for (let off = 0; off < lookahead; off++) {
      const d = new Date(today);
      d.setDate(today.getDate() + off);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const targetMMDD = `${mm}-${dd}`;
      const isToday = off === 0;
      const labelDia = isToday ? "Hoy" : off === 1 ? "Mañana" : `En ${off} días`;

      for (const p of personas ?? []) {
        const nom = `${p.nombres ?? ""} ${p.apellidos ?? ""}`.trim();
        const checks: Array<[string, string | null, string, (years: number | null) => string]> = [
          ["cumpleanos", p.nac_fecha, "Cumpleaños", (y) => p.viva === "fallecida" || p.defuncion_fecha
            ? (y ? `Habría cumplido ${y} años.` : `Aniversario de su nacimiento.`)
            : (y ? `Cumple ${y} años.` : `Es su cumpleaños.`)],
          ["aniv_def", p.defuncion_fecha, "Aniversario de fallecimiento", (y) => y ? `Han pasado ${y} años desde su fallecimiento.` : `Aniversario de su fallecimiento.`],
          ["aniv_bautismo", p.bautismo_fecha, "Aniversario de bautismo", (y) => y ? `${y} años desde su bautismo.` : `Aniversario de su bautismo.`],
          ["aniv_matrimonio", p.matrimonio_fecha, "Aniversario de matrimonio", (y) => y ? `${y} años desde su matrimonio.` : `Aniversario de matrimonio.`],
          ["aniv_entierro", p.entierro_fecha, "Aniversario de entierro", (y) => y ? `${y} años desde su entierro.` : `Aniversario de entierro.`],
        ];
        for (const [tipo, fecha, base, msgFn] of checks) {
          if (mmdd(fecha) !== targetMMDD) continue;
          const baseYear = yearOf(fecha);
          const yearsAhead = baseYear ? (todayY - baseYear) + (off > 0 && d.getFullYear() !== todayY ? 1 : 0) : null;
          const key = `${tipo}:${p.id}:${d.toISOString().slice(0, 10)}`;
          items.push({
            tipo: `aniversario_${tipo}`,
            titulo: `${labelDia}: ${base} de ${nom}`,
            mensaje: msgFn(yearsAhead),
            persona_id: p.id,
            key,
          });
        }
      }
    }

    if (!items.length) return new Response(JSON.stringify({ ok: true, creadas: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Filtrar las que ya existen hoy con la misma key (metadata.key)
    const { data: existentes } = await sb.from("notificaciones")
      .select("metadata").eq("user_id", userId)
      .gte("created_at", new Date(Date.now() - 30 * 86400_000).toISOString());
    const ya = new Set<string>();
    for (const r of existentes ?? []) {
      const k = (r as any).metadata?.key;
      if (k) ya.add(k);
    }

    const nuevas = items.filter((i) => !ya.has(i.key));
    if (!nuevas.length) return new Response(JSON.stringify({ ok: true, creadas: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const rows = nuevas.map((i) => ({
      user_id: userId,
      tipo: i.tipo,
      titulo: i.titulo,
      mensaje: i.mensaje,
      url: `/personas/${i.persona_id}`,
      metadata: { key: i.key, persona_id: i.persona_id },
    }));
    await sb.from("notificaciones").insert(rows);

    return new Response(JSON.stringify({ ok: true, creadas: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notificar-aniversarios", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
