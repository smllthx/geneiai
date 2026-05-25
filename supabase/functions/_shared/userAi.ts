// Helper compartido: decide si usamos la API key de OpenAI del usuario
// (guardada en app_config.openai_api_key) o el AI Gateway de Lovable.
// Si el usuario tiene su propia key, NO se gastan créditos de Lovable.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type AiTarget = {
  url: string;
  key: string;
  model: string;
  provider: "openai-user" | "lovable";
};

// Mapea modelos del catálogo Lovable a equivalentes OpenAI puros
function mapModelForOpenAI(model?: string): string {
  if (!model) return "gpt-4o-mini";
  if (model.startsWith("openai/")) return model.slice("openai/".length);
  // Mapeos seguros desde Gemini → OpenAI
  if (model.includes("gemini-2.5-pro")) return "gpt-4o";
  if (model.includes("gemini-3-pro") || model.includes("gemini-3.1-pro")) return "gpt-4o";
  if (model.includes("flash-lite") || model.includes("nano")) return "gpt-4o-mini";
  if (model.includes("flash")) return "gpt-4o-mini";
  return "gpt-4o-mini";
}

// Llama con el authHeader del request original para que RLS aplique sobre app_config.
export async function pickAiTarget(authHeader: string | null, requestedModel?: string): Promise<AiTarget> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
  const fallback: AiTarget = {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    key: lovableKey,
    model: requestedModel || "google/gemini-3-flash-preview",
    provider: "lovable",
  };
  if (!authHeader) return fallback;
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: cfg } = await supa
      .from("app_config")
      .select("openai_api_key,ai_preferred_provider")
      .maybeSingle();
    const userKey = (cfg?.openai_api_key ?? "").trim();
    const pref = cfg?.ai_preferred_provider ?? "auto";
    if (userKey && (pref === "auto" || pref === "openai")) {
      return {
        url: "https://api.openai.com/v1/chat/completions",
        key: userKey,
        model: mapModelForOpenAI(requestedModel),
        provider: "openai-user",
      };
    }
  } catch (_e) { /* ignore, fallback */ }
  return fallback;
}

// Helper de conveniencia: hace fetch chat-completions con el target apropiado.
export async function aiChat(authHeader: string | null, body: Record<string, any>) {
  const target = await pickAiTarget(authHeader, body.model);
  const finalBody = { ...body, model: target.model };
  const res = await fetch(target.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${target.key}` },
    body: JSON.stringify(finalBody),
  });
  return { res, target };
}
