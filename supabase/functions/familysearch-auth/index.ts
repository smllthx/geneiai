// FamilySearch OAuth - inicia el flujo y maneja el callback (con state verificado)
// POST /familysearch-auth con { action: "start" | "exchange" | "status" | "disconnect", code?, state?, redirect_uri }
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

function isSafeRedirect(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 500) return false;
  try {
    const url = new URL(value);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) return false;
    return url.pathname === "/familysearch/callback";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const clientId = Deno.env.get("FAMILYSEARCH_CLIENT_ID");
    const clientSecret = Deno.env.get("FAMILYSEARCH_CLIENT_SECRET") ?? "";
    if (!clientId) throw new Error("FamilySearch Client ID no configurado");

    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("No autenticado");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión inválida");

    const body = await req.json().catch(() => ({}));
    const { action, code, redirect_uri } = body ?? {};
    const state = typeof body?.state === "string" ? body.state : "";

    if (action === "status") {
      const { data } = await supabase.from("external_accounts")
        .select("id, provider, expires_at, scope, account_ref, created_at, updated_at")
        .eq("user_id", user.id)
        .eq("provider", "familysearch")
        .maybeSingle();
      return new Response(JSON.stringify({ connected: !!data, account: data ?? null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      const { error } = await supabase.from("external_accounts")
        .delete().eq("user_id", user.id).eq("provider", "familysearch");
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "start") {
      if (!isSafeRedirect(redirect_uri)) throw new Error("redirect_uri no permitida");
      const newState = crypto.randomUUID();
      const { error } = await supabase.from("familysearch_oauth_states").insert({
        user_id: user.id,
        state: newState,
        redirect_uri,
      });
      if (error) throw error;
      const url = new URL(FS_AUTH);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirect_uri);
      url.searchParams.set("state", newState);
      return new Response(JSON.stringify({ url: url.toString(), state: newState }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "exchange") {
      if (!code || typeof code !== "string") throw new Error("Falta el código de autorización");
      if (!state) throw new Error("Falta el parámetro de seguridad (state)");
      if (!isSafeRedirect(redirect_uri)) throw new Error("redirect_uri no permitida");

      const { data: saved } = await supabase.from("familysearch_oauth_states")
        .select("id, redirect_uri, used_at, expires_at")
        .eq("user_id", user.id)
        .eq("state", state)
        .maybeSingle();
      if (!saved) throw new Error("Autorización no reconocida. Vuelve a iniciar la conexión.");
      if (saved.used_at) throw new Error("Esta autorización ya fue utilizada.");
      if (new Date(saved.expires_at).getTime() < Date.now()) {
        throw new Error("La autorización expiró. Vuelve a iniciar la conexión.");
      }
      if (saved.redirect_uri !== redirect_uri) throw new Error("La dirección de retorno no coincide.");

      const { error: usedError } = await supabase.from("familysearch_oauth_states")
        .update({ used_at: new Date().toISOString() })
        .eq("id", saved.id)
        .is("used_at", null);
      if (usedError) throw usedError;

      const params: Record<string, string> = {
        grant_type: "authorization_code",
        code,
        redirect_uri,
        client_id: clientId,
      };
      if (clientSecret) params.client_secret = clientSecret;
      const tokenRes = await fetch(FS_TOKEN, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: new URLSearchParams(params),
      });
      const tokenData = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tokenData?.access_token) {
        throw new Error("FamilySearch rechazó el intercambio del código de autorización.");
      }

      const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString();
      const { error } = await supabase.from("external_accounts").upsert({
        user_id: user.id,
        provider: "familysearch",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? null,
        expires_at: expiresAt,
        scope: tokenData.scope ?? null,
        metadata: { token_type: tokenData.token_type ?? null, env: FS_ENV },
      }, { onConflict: "user_id,provider" });
      if (error) throw error;

      await supabase.from("familysearch_oauth_states")
        .delete()
        .eq("user_id", user.id)
        .lt("expires_at", new Date().toISOString());

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Acción desconocida");
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Error de autorización" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
