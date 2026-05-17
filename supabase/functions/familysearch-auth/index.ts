// FamilySearch OAuth - inicia el flujo y maneja el callback
// POST /familysearch-auth con { action: "start" | "exchange", code?, redirect_uri }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Soporta sandbox (integration) y producción.
// Configurar FAMILYSEARCH_ENV = "sandbox" | "beta" para usar el entorno de integración.
const FS_ENV = (Deno.env.get("FAMILYSEARCH_ENV") ?? "production").toLowerCase();
const FS_HOST = (FS_ENV === "sandbox" || FS_ENV === "beta" || FS_ENV === "integration")
  ? "https://identbeta.familysearch.org"
  : "https://ident.familysearch.org";
const FS_AUTH = `${FS_HOST}/cis-web/oauth2/v3/authorization`;
const FS_TOKEN = `${FS_HOST}/cis-web/oauth2/v3/token`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const clientId = Deno.env.get("FAMILYSEARCH_CLIENT_ID");
    const clientSecret = Deno.env.get("FAMILYSEARCH_CLIENT_SECRET");
    if (!clientId || !clientSecret) throw new Error("FamilySearch no configurado");

    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("No autenticado");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión inválida");

    const body = await req.json();
    const { action, code, redirect_uri } = body;

    if (action === "start") {
      const state = crypto.randomUUID();
      const url = new URL(FS_AUTH);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirect_uri);
      url.searchParams.set("state", state);
      return new Response(JSON.stringify({ url: url.toString(), state }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "exchange") {
      if (!code || !redirect_uri) throw new Error("Faltan code/redirect_uri");
      const tokenRes = await fetch(FS_TOKEN, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(`FS token: ${JSON.stringify(tokenData)}`);

      const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString();
      const { error } = await supabase.from("external_accounts").upsert({
        user_id: user.id,
        provider: "familysearch",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? null,
        expires_at: expiresAt,
        scope: tokenData.scope ?? null,
        metadata: { token_type: tokenData.token_type },
      }, { onConflict: "user_id,provider" });
      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Acción desconocida");
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
