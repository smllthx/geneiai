type EnvReader = (name: string) => string | undefined;
const dedicatedUrl = "https://camdtylwddleifaegzaf.supabase.co";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function rejection(status: number) {
  return new Response(JSON.stringify({ error: status === 401 ? "No autenticado" : "Autenticación no disponible" }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// The platform flag is defense in depth, not the application's identity check.
// Validate every bearer token with this dedicated project's Auth service before
// reading request data, querying genealogy, sending notifications, or using AI.
export async function rejectUnauthenticated(
  req: Request,
  env: EnvReader = (name) => Deno.env.get(name),
  fetcher: typeof fetch = fetch,
): Promise<Response | null> {
  if (req.method === "OPTIONS") return null;
  const authorization = req.headers.get("Authorization") ?? "";
  if (authorization.length > 8192 || !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization)) {
    return rejection(401);
  }
  const url = env("SUPABASE_URL");
  let publicKey = env("SUPABASE_ANON_KEY");
  try {
    publicKey = JSON.parse(env("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default ?? publicKey;
  } catch { /* Keep compatibility with the platform's legacy public key. */ }
  if (url !== dedicatedUrl || !publicKey) return rejection(503);
  try {
    const response = await fetcher(`${url}/auth/v1/user`, {
      headers: { apikey: publicKey, Authorization: authorization },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return rejection(response.status >= 500 ? 503 : 401);
    const user = await response.json();
    if (typeof user?.id !== "string" || !user.id || user.is_anonymous === true) return rejection(401);
    return null;
  } catch {
    return rejection(503);
  }
}
