// Helper compartido: todas las funciones de IA usan OpenAI/ChatGPT.
// No hay fallback a otros gateways.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type AiTarget = {
  url: string;
  key: string;
  model: string;
  provider: "openai-user";
};

// Mapea modelos históricos del proyecto a equivalentes OpenAI puros.
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
  const envOpenAIKey = (Deno.env.get("OPENAI_API_KEY") ?? "").trim();
  try {
    if (authHeader) {
      const supa = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: cfg } = await supa
        .from("app_config")
        .select("openai_api_key")
        .maybeSingle();
      const userKey = (cfg?.openai_api_key ?? "").trim();
      if (userKey) {
        return {
          url: "https://api.openai.com/v1/chat/completions",
          key: userKey,
          model: mapModelForOpenAI(requestedModel),
          provider: "openai-user",
        };
      }
    }
  } catch (_e) { /* ignore, fallback */ }

  if (envOpenAIKey) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      key: envOpenAIKey,
      model: mapModelForOpenAI(requestedModel),
      provider: "openai-user",
    };
  }

  throw new Error("OpenAI no configurado. Agrega tu API key en Configuración → IA para usar ChatGPT en la app.");
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
