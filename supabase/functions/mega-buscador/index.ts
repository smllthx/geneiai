// Lanza varios agentes en paralelo para una persona:
//  1) buscar-externo-auto modo "advanced" (filtros + variantes fonéticas)
//  2) buscar-externo-auto modo "broad" (sin filtros, búsquedas libres)
//  3) investigar-auto (hipótesis + sugerencias por IA)
//  4) investigar-auto foco ascendientes
//  5) investigar-auto foco descendientes
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("No autenticado");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser();
    if (!u.user) throw new Error("Sesión inválida");

    const { persona_id } = await req.json().catch(() => ({}));
    if (!persona_id) throw new Error("Falta persona_id");

    await sb.from("actividad").insert({
      user_id: u.user.id,
      tipo: "mega_buscador_inicio",
      descripcion: "Agentes smart buscando información del árbol en segundo plano",
      metadata: { persona_id, estado: "procesando" },
    });

    const callFn = async (name: string, body: Record<string, unknown>) => {
      const t0 = Date.now();
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: auth, apikey: ANON },
          body: JSON.stringify(body),
        });
        const j = await r.json().catch(() => ({}));
        return { agent: name, ok: r.ok, status: r.status, ms: Date.now() - t0, ...j };
      } catch (e) {
        return { agent: name, ok: false, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
      }
    };

    const tasks = [
      callFn("buscar-externo-auto", { persona_id, modo: "advanced" }),
      callFn("buscar-externo-auto", { persona_id, modo: "broad" }),
      callFn("web-search-libre", { persona_id }),
      callFn("investigar-auto", { person_id: persona_id }),
      callFn("investigar-auto", { person_id: persona_id, foco: "ascendientes" }),
      callFn("investigar-auto", { person_id: persona_id, foco: "descendientes" }),
    ];
    const results = await Promise.allSettled(tasks);
    const flat = results.map((r) => (r.status === "fulfilled" ? r.value : { ok: false, error: String(r.reason) }));

    const sugerencias = flat.reduce((s, r: any) => s + (r.sugerencias ?? r.sugerencias_creadas ?? 0), 0);
    const hipotesis = flat.reduce((s, r: any) => s + (r.hipotesis_creadas ?? 0), 0);
    const ok_count = flat.filter((r: any) => r.ok).length;

    await sb.from("notificaciones").insert({
      user_id: u.user.id,
      titulo: "Mega-buscador completado",
      mensaje: `${ok_count}/${flat.length} agentes ok · ${sugerencias} sugerencias · ${hipotesis} hipótesis`,
      tipo: "info",
      url: `/personas/${persona_id}`,
    });

    await sb.from("actividad").insert({
      user_id: u.user.id,
      tipo: "mega_buscador_completado",
      descripcion: `Insights smart completados: ${sugerencias} sugerencias · ${hipotesis} hipótesis`,
      metadata: { persona_id, estado: "completado", sugerencias, hipotesis, ok_count },
    });

    return new Response(JSON.stringify({ ok: true, agents: flat, sugerencias, hipotesis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    try {
      const auth = req.headers.get("Authorization");
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
      const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth ?? "" } } });
      const { data: u } = await sb.auth.getUser();
      if (u.user) {
        await sb.from("actividad").insert({
          user_id: u.user.id,
          tipo: "mega_buscador_error",
          descripcion: "Los agentes smart no pudieron completar la búsqueda",
          metadata: { estado: "error", error: e instanceof Error ? e.message : "Error" },
        });
      }
    } catch {}
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
