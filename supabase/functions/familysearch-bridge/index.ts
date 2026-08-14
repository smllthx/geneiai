// Puente privado y autenticado hacia la API de FamilySearch.
// Nunca expone tokens al cliente: sólo devuelve datos ya leídos de FamilySearch.
// POST /familysearch-bridge con { action, ...params }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FS_ENV = (Deno.env.get("FAMILYSEARCH_ENV") ?? "production").toLowerCase();
const IS_BETA = FS_ENV === "sandbox" || FS_ENV === "beta" || FS_ENV === "integration";
const FS_API = IS_BETA ? "https://apibeta.familysearch.org" : "https://api.familysearch.org";
const FS_TOKEN = IS_BETA
  ? "https://identbeta.familysearch.org/cis-web/oauth2/v3/token"
  : "https://ident.familysearch.org/cis-web/oauth2/v3/token";

const FS_ID = /^[A-Z0-9]{4}-[A-Z0-9]{3,4}$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function freshToken(admin: any, account: any) {
  const expires = account.expires_at ? new Date(account.expires_at).getTime() : 0;
  if (!expires || expires - Date.now() > 60_000 || !account.refresh_token) return account.access_token;
  const clientId = Deno.env.get("FAMILYSEARCH_CLIENT_ID");
  const clientSecret = Deno.env.get("FAMILYSEARCH_CLIENT_SECRET") ?? "";
  if (!clientId) return account.access_token;
  const params: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: account.refresh_token,
    client_id: clientId,
  };
  if (clientSecret) params.client_secret = clientSecret;
  const res = await fetch(FS_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) return account.access_token;
  await admin.from("external_accounts").update({
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? account.refresh_token,
    expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
  }).eq("id", account.id);
  return data.access_token;
}

async function fsGet(token: string, path: string) {
  const res = await fetch(`${FS_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/x-gedcomx-v1+json" },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("FamilySearch rechazó la autorización. Vuelve a conectar tu cuenta.");
  }
  if (!res.ok) throw new Error(`FamilySearch respondió ${res.status} en esta consulta.`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "No autenticado" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Sesión inválida" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: account } = await admin.from("external_accounts")
      .select("*").eq("user_id", user.id).eq("provider", "familysearch").maybeSingle();
    if (!account?.access_token) {
      return json({ error: "No hay una cuenta de FamilySearch conectada.", connected: false }, 409);
    }

    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "";
    const token = await freshToken(admin, account);

    if (action === "current_user") {
      return json({ result: await fsGet(token, "/platform/users/current") });
    }

    if (action === "current_person") {
      return json({ result: await fsGet(token, "/platform/tree/current-person") });
    }

    if (action === "person") {
      const id = String(body?.personId ?? "").toUpperCase();
      if (!FS_ID.test(id)) return json({ error: "Identificador de FamilySearch no válido." }, 400);
      return json({ result: await fsGet(token, `/platform/tree/persons/${id}`) });
    }

    if (action === "person_relatives") {
      const id = String(body?.personId ?? "").toUpperCase();
      if (!FS_ID.test(id)) return json({ error: "Identificador de FamilySearch no válido." }, 400);
      const [parents, children, spouses] = await Promise.all([
        fsGet(token, `/platform/tree/persons/${id}/parents`).catch(() => null),
        fsGet(token, `/platform/tree/persons/${id}/children`).catch(() => null),
        fsGet(token, `/platform/tree/persons/${id}/spouses`).catch(() => null),
      ]);
      return json({ result: { parents, children, spouses } });
    }

    if (action === "search") {
      const q: string[] = [];
      const add = (key: string, value: unknown, max = 120) => {
        if (typeof value !== "string") return;
        const clean = value.trim().slice(0, max).replace(/[^\p{L}\p{N}\s'.-]/gu, "");
        if (clean) q.push(`${key}:"${clean}"`);
      };
      add("givenName", body?.givenName);
      add("surname", body?.surname);
      add("birthLikePlace", body?.birthPlace);
      add("birthLikeDate", body?.birthDate, 40);
      add("deathLikeDate", body?.deathDate, 40);
      if (!q.length) return json({ error: "Indica al menos un nombre o apellido para buscar." }, 400);
      const count = Math.min(Math.max(Number(body?.limit) || 10, 1), 50);
      const path = `/platform/tree/search?q=${encodeURIComponent(q.join(" "))}&count=${count}`;
      return json({ result: await fsGet(token, path) });
    }

    if (action === "person_sources") {
      const id = String(body?.personId ?? "").toUpperCase();
      if (!FS_ID.test(id)) return json({ error: "Identificador de FamilySearch no válido." }, 400);
      return json({ result: await fsGet(token, `/platform/tree/persons/${id}/sources`) });
    }

    return json({ error: "Acción no soportada por el puente de FamilySearch." }, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? "Error al consultar FamilySearch" }, 400);
  }
});
