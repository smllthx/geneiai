import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { pickAiTarget, prepareEconomyChatBody } from "../_shared/userAi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Provider = "gemini" | "openai" | "anthropic";

async function callGemini(model: string, prompt: string, system?: string, authHeader?: string | null): Promise<{ text: string }> {
  const target = await pickAiTarget(authHeader ?? null, model);
  const body = prepareEconomyChatBody({
    model,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: prompt },
    ],
    max_tokens: 800,
  }, target.model);
  const r = await fetch(target.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${target.key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`OpenAI error ${r.status}: ${t}`);
  }
  const data = await r.json();
  return { text: data.choices?.[0]?.message?.content ?? "" };
}

async function callOpenAI(model: string, prompt: string, system?: string, authHeader?: string | null) {
  // Prioriza la API key personal del usuario (app_config.openai_api_key)
  const target = await pickAiTarget(authHeader ?? null, model.startsWith("openai/") ? model : `openai/${model}`);
  const body = prepareEconomyChatBody({
    model,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: prompt },
    ],
    max_tokens: 800,
  }, target.model);
  const r = await fetch(target.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${target.key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
      max_tokens: 900,
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
      if (provider === "gemini") text = (await callGemini(run.modelo, run.prompt, system, auth)).text;
      else if (provider === "openai") text = (await callOpenAI(run.modelo, run.prompt, system, auth)).text;
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
