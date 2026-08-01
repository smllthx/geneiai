import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Json = Record<string, unknown>;

export function json(res: any, status: number, body: unknown) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function getBearer(req: any) {
  const raw = req.headers.authorization ?? req.headers.Authorization ?? "";
  return typeof raw === "string" && raw.startsWith("Bearer ") ? raw : "";
}

export function getSupabase(req: any): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase no está configurado en el servidor");
  return createClient(url, key, { global: { headers: { Authorization: getBearer(req) } } });
}

export function getServiceSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("El acceso privado de GENEAI Work no está configurado en el servidor");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function getUserOrThrow(sb: SupabaseClient) {
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new Error("No autenticado");
  return data.user;
}

export async function getActiveTreeId(sb: SupabaseClient, userId: string) {
  const { data } = await sb.from("profiles").select("active_arbol_id").eq("id", userId).maybeSingle();
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
