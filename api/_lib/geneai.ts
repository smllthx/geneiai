import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BackendConfigurationError, resolveServerBackendConfig, resolveServiceBackendConfig } from "../../shared/backendIdentity.js";

type Json = Record<string, unknown>;

export function json(res: any, status: number, body: unknown) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function getBearer(req: any) {
  const raw = req.headers?.authorization ?? req.headers?.Authorization;
  if (typeof raw !== "string" || raw.length > 16_384) return "";
  const token = /^Bearer[ \t]+([A-Za-z0-9._~+/=-]+)$/i.exec(raw)?.[1];
  return token ? `Bearer ${token}` : "";
}

export function getSupabase(req: any): SupabaseClient {
  const { supabaseUrl, publishableKey } = resolveServerBackendConfig(process.env);
  return createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: getBearer(req) } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function getServiceSupabase(): SupabaseClient {
  const { supabaseUrl, secretKey } = resolveServiceBackendConfig(process.env);
  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export class GeneaiConnectionError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
    this.name = "GeneaiConnectionError";
  }
}

export function connectionError(error: unknown) {
  if (error instanceof BackendConfigurationError || error instanceof GeneaiConnectionError) {
    return { status: error.status, code: error.code, message: error.message };
  }
  return null;
}

export function jsonApiError(res: any, error: unknown, fallback: string) {
  const known = connectionError(error);
  return json(res, known?.status ?? 500, {
    error: known?.message ?? (error instanceof Error ? error.message : fallback),
    ...(known ? { code: known.code } : {}),
  });
}

export async function getUserOrThrow(sb: SupabaseClient, accessToken: string) {
  if (!accessToken) throw new GeneaiConnectionError("AUTH_REQUIRED", "No autenticado", 401);
  let result: Awaited<ReturnType<typeof sb.auth.getUser>>;
  try {
    // This network request verifies the supplied token with the canonical Auth
    // server. Never derive a user's identity from an unverified JWT payload.
    result = await sb.auth.getUser(accessToken);
  } catch {
    throw new GeneaiConnectionError("AUTH_UNAVAILABLE", "No se pudo comprobar la sesión de GENEAI. Reintenta cuando haya conexión.", 503);
  }
  const { data, error } = result;
  if (error) {
    if (/invalid api key|invalid apikey/i.test(error.message)) {
      throw new BackendConfigurationError("BACKEND_PUBLIC_KEY_REJECTED");
    }
    if (!error.status || error.status >= 500 || error.status === 429) {
      throw new GeneaiConnectionError("AUTH_UNAVAILABLE", "No se pudo comprobar la sesión de GENEAI. Reintenta cuando haya conexión.", 503);
    }
    throw new GeneaiConnectionError("AUTH_INVALID", "No autenticado", 401);
  }
  if (!data.user?.id) throw new GeneaiConnectionError("AUTH_INVALID", "No autenticado", 401);
  return data.user;
}

export async function getActiveTreeId(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb.from("profiles").select("active_arbol_id").eq("id", userId).maybeSingle();
  if (error) throw new GeneaiConnectionError("PROFILE_UNAVAILABLE", "No se pudo consultar el árbol activo. Reintenta antes de continuar.", 503);
  return (data as any)?.active_arbol_id ?? null;
}

export async function getOpenAIKey(sb: SupabaseClient) {
  const envKey = (process.env.OPENAI_API_KEY ?? "").trim();
  const { data } = await sb.from("app_config").select("openai_api_key").maybeSingle();
  const userKey = String((data as any)?.openai_api_key ?? "").trim();
  const key = userKey || envKey;
  if (!key) throw new Error("OpenAI no configurado. Agrega tu API key en Configuración → IA.");
  return key;
}

export async function openAIJson(sb: SupabaseClient, messages: Array<{ role: "system" | "user"; content: string }>, schemaHint: string) {
  const key = await getOpenAIKey(sb);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        ...messages,
        { role: "user", content: `Devuelve sólo JSON válido con esta forma esperada:\n${schemaHint}` },
      ],
    }),
  });
  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`OpenAI ${response.status}: ${raw.slice(0, 240)}`);
  }
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content) as Json;
  } catch {
    throw new Error("La IA respondió con JSON inválido");
  }
}

export function limitPublicDocumentText(text: string) {
  return text
    .replace(/\b[\w.+-]+@[\w.-]+\.\w+\b/g, "[correo omitido]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[telefono omitido]")
    .slice(0, 12000);
}

export function suggestionTitle(type: string) {
  if (type === "relacion") return "Posible relación familiar";
  if (type === "duplicado") return "Posible duplicado";
  if (type === "evento") return "Posible evento vital";
  return "Sugerencia de IA";
}
