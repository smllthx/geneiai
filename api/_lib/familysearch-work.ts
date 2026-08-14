import type { SupabaseClient } from "@supabase/supabase-js";
import { GeneaiWorkError } from "./geneai-work/index.js";

const FS_ENV = (process.env.FAMILYSEARCH_ENV ?? "production").toLowerCase();
const IS_BETA = FS_ENV === "sandbox" || FS_ENV === "beta" || FS_ENV === "integration";
const FS_API = IS_BETA ? "https://apibeta.familysearch.org" : "https://api.familysearch.org";
const FS_TOKEN_URL = IS_BETA
  ? "https://identbeta.familysearch.org/cis-web/oauth2/v3/token"
  : "https://ident.familysearch.org/cis-web/oauth2/v3/token";

const FS_ID = /^[A-Z0-9]{4}-[A-Z0-9]{3,4}$/;

type Account = {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
};

function personId(value: string) {
  const id = value.trim().toUpperCase();
  if (!FS_ID.test(id)) {
    throw new GeneaiWorkError("FS_INVALID_ID", "El identificador de FamilySearch no es válido (formato ABCD-123).", 400);
  }
  return id;
}

async function loadAccount(sb: SupabaseClient, userId: string): Promise<Account> {
  const { data, error } = await sb.from("external_accounts")
    .select("id, access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "familysearch")
    .maybeSingle();
  if (error) {
    throw new GeneaiWorkError("FS_ACCOUNT_ERROR", "No se pudo leer la conexión de FamilySearch.", 500);
  }
  if (!data?.access_token) {
    throw new GeneaiWorkError(
      "FS_NOT_CONNECTED",
      "Esta cuenta de GENEAI no tiene FamilySearch conectado. Conéctalo en GENEAI → Importar.",
      409,
    );
  }
  return data as Account;
}

async function freshToken(sb: SupabaseClient, account: Account) {
  const expires = account.expires_at ? new Date(account.expires_at).getTime() : 0;
  if (!expires || expires - Date.now() > 60_000 || !account.refresh_token) {
    return account.access_token as string;
  }
  const clientId = process.env.FAMILYSEARCH_CLIENT_ID;
  const clientSecret = process.env.FAMILYSEARCH_CLIENT_SECRET ?? "";
  if (!clientId) return account.access_token as string;
  const params: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: account.refresh_token,
    client_id: clientId,
  };
  if (clientSecret) params.client_secret = clientSecret;
  const res = await fetch(FS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(params),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const token = typeof data.access_token === "string" ? data.access_token : "";
  if (!res.ok || !token) return account.access_token as string;
  await sb.from("external_accounts").update({
    access_token: token,
    refresh_token: typeof data.refresh_token === "string" ? data.refresh_token : account.refresh_token,
    expires_at: new Date(Date.now() + (Number(data.expires_in) || 3600) * 1000).toISOString(),
  }).eq("id", account.id);
  return token;
}

async function fsGet(sb: SupabaseClient, userId: string, path: string) {
  const account = await loadAccount(sb, userId);
  const token = await freshToken(sb, account);
  const res = await fetch(`${FS_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/x-gedcomx-v1+json" },
  });
  if (res.status === 401 || res.status === 403) {
    throw new GeneaiWorkError(
      "FS_UNAUTHORIZED",
      "FamilySearch rechazó la autorización. Vuelve a conectar la cuenta en GENEAI.",
      403,
    );
  }
  if (!res.ok) {
    throw new GeneaiWorkError("FS_REQUEST_FAILED", `FamilySearch respondió ${res.status} en esta consulta.`, 502);
  }
  return res.json();
}

export async function fsStatus(sb: SupabaseClient, userId: string) {
  const { data } = await sb.from("external_accounts")
    .select("expires_at, scope, created_at, updated_at")
    .eq("user_id", userId)
    .eq("provider", "familysearch")
    .maybeSingle();
  return { connected: !!data, environment: IS_BETA ? "beta" : "production", account: data ?? null };
}

export async function fsCurrentPerson(sb: SupabaseClient, userId: string) {
  return fsGet(sb, userId, "/platform/tree/current-person");
}

export async function fsPerson(sb: SupabaseClient, userId: string, input: { personId: string }) {
  return fsGet(sb, userId, `/platform/tree/persons/${personId(input.personId)}`);
}

export async function fsRelatives(sb: SupabaseClient, userId: string, input: { personId: string }) {
  const id = personId(input.personId);
  const [parents, children, spouses] = await Promise.all([
    fsGet(sb, userId, `/platform/tree/persons/${id}/parents`).catch(() => null),
    fsGet(sb, userId, `/platform/tree/persons/${id}/children`).catch(() => null),
    fsGet(sb, userId, `/platform/tree/persons/${id}/spouses`).catch(() => null),
  ]);
  return { personId: id, parents, children, spouses };
}

export async function fsSources(sb: SupabaseClient, userId: string, input: { personId: string }) {
  return fsGet(sb, userId, `/platform/tree/persons/${personId(input.personId)}/sources`);
}

export async function fsSearch(sb: SupabaseClient, userId: string, input: {
  givenName?: string | null;
  surname?: string | null;
  birthPlace?: string | null;
  birthDate?: string | null;
  deathDate?: string | null;
  limit?: number;
}) {
  const terms: string[] = [];
  const add = (key: string, value: unknown, max = 120) => {
    if (typeof value !== "string") return;
    const clean = value.trim().slice(0, max).replace(/[^\p{L}\p{N}\s'.-]/gu, "");
    if (clean) terms.push(`${key}:"${clean}"`);
  };
  add("givenName", input.givenName);
  add("surname", input.surname);
  add("birthLikePlace", input.birthPlace);
  add("birthLikeDate", input.birthDate, 40);
  add("deathLikeDate", input.deathDate, 40);
  if (!terms.length) {
    throw new GeneaiWorkError("FS_EMPTY_QUERY", "Indica al menos un nombre o apellido para buscar en FamilySearch.", 400);
  }
  const count = Math.min(Math.max(Number(input.limit) || 10, 1), 50);
  const path = `/platform/tree/search?q=${encodeURIComponent(terms.join(" "))}&count=${count}`;
  return fsGet(sb, userId, path);
}
