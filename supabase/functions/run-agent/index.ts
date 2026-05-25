import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { pickAiTarget } from "../_shared/userAi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Provider = "gemini" | "openai" | "anthropic";

async function callGemini(model: string, prompt: string, system?: string, authHeader?: string | null): Promise<{ text: string }> {
  // Usa la key de OpenAI del usuario si está configurada; si no, Lovable AI Gateway.
  const target = await pickAiTarget(authHeader ?? null, model);
  const key = target.key;
  if (!key) throw new Error("LOVABLE_API_KEY no configurada");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    if (r.status === 429) throw new Error("Límite de uso alcanzado en Lovable AI. Esperá un minuto.");
    if (r.status === 402) throw new Error("Sin créditos en Lovable AI. Agregá créditos en Workspace → Usage.");
    throw new Error(`Gemini error ${r.status}: ${t}`);
  }
  const data = await r.json();
  return { text: data.choices?.[0]?.message?.content ?? "" };
}

async function callOpenAI(model: string, prompt: string, system?: string) {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY no configurada");
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!r.ok) throw new Error(`OpenAI error ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return { text: data.choices?.[0]?.message?.content ?? "" };
}

async function callAnthropic(model: string, prompt: string, system?: string) {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY no configurada");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: system ?? undefined,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic error ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const text = (data.content ?? []).map((c: any) => c.text ?? "").join("\n");
  return { text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { runId } = await req.json();
    if (!runId) throw new Error("Falta runId");

    const { data: run, error: rerr } = await supabase.from("agent_runs").select("*").eq("id", runId).maybeSingle();
    if (rerr || !run) throw new Error("Run no encontrada");

    await supabase.from("agent_runs").update({ status: "running" }).eq("id", runId);
    const t0 = Date.now();

    const system =
      "Sos un asistente experto en genealogía. Respondés en español, citando fuentes cuando sea posible. Si proponés hipótesis, dejá claro que son hipótesis, no hechos comprobados.";

    let text = "";
    try {
      const provider = run.provider as Provider;
      if (provider === "gemini") text = (await callGemini(run.modelo, run.prompt, system)).text;
      else if (provider === "openai") text = (await callOpenAI(run.modelo, run.prompt, system)).text;
      else if (provider === "anthropic") text = (await callAnthropic(run.modelo, run.prompt, system)).text;
      else throw new Error(`Proveedor desconocido: ${provider}`);

      await supabase.from("agent_runs").update({
        status: "done",
        resultado: text,
        duracion_ms: Date.now() - t0,
      }).eq("id", runId);
    } catch (err: any) {
      await supabase.from("agent_runs").update({
        status: "error",
        error: err.message ?? String(err),
        duracion_ms: Date.now() - t0,
      }).eq("id", runId);
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
