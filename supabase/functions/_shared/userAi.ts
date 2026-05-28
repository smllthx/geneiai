// Helper compartido: todas las funciones de IA usan OpenAI/ChatGPT.
// No hay fallback a otros gateways.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type AiTarget = {
  url: string;
  key: string;
  model: string;
  provider: "openai-user";
};

const DEFAULT_ECONOMY_MODEL = "gpt-4o-mini";
const DEFAULT_MAX_TOKENS = 900;
const HARD_MAX_TOKENS = 1400;

// Mapea modelos históricos del proyecto a equivalentes OpenAI puros.
function mapModelForOpenAI(model?: string): string {
  // Modo ahorro: todas las funciones conservan sus opciones, pero usan el modelo
  // multimodal económico por defecto. Si más adelante se necesita más precisión
  // en una función puntual, se puede habilitar desde aquí.
  if (!model) return DEFAULT_ECONOMY_MODEL;
  return DEFAULT_ECONOMY_MODEL;
}

export function prepareEconomyChatBody(body: Record<string, any>, model: string) {
  const requestedMax = Number(body.max_tokens ?? body.max_completion_tokens ?? DEFAULT_MAX_TOKENS);
  const max_tokens = Math.max(120, Math.min(Number.isFinite(requestedMax) ? requestedMax : DEFAULT_MAX_TOKENS, HARD_MAX_TOKENS));
  const finalBody = {
    ...body,
    model,
    temperature: body.temperature ?? 0.2,
    max_tokens,
  };
  delete (finalBody as any).max_completion_tokens;
  return finalBody;
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
  const finalBody = prepareEconomyChatBody(body, target.model);
  const res = await fetch(target.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${target.key}` },
    body: JSON.stringify(finalBody),
  });
  return { res, target };
}
