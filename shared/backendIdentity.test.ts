import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BackendConfigurationError, getCanonicalBackendIdentity,
  resolvePublicBackendConfig, resolveServerBackendConfig, resolveServiceBackendConfig,
} from "./backendIdentity";
import health from "../api/health";
import oauthMetadata from "../api/oauth-protected-resource";
import { getPublicAppOrigin } from "../api/_lib/publicOrigin";

const identity = getCanonicalBackendIdentity();
const OLD_PROJECT = "fbqovchaouhisdyxhdhy";
const PUBLIC_FIXTURE = "sb_publishable_test_fixture_not_a_real_key";
const SERVER_FIXTURE = "sb_secret_test_fixture_not_a_real_key";
const ENV_NAMES = [
  "SUPABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_PROJECT_ID", "SUPABASE_PROJECT_REF", "VITE_SUPABASE_PROJECT_ID",
  "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "GENEAI_PUBLIC_URL",
];

function legacyKey(role: string, ref = identity.projectRef) {
  const encode = (input: unknown) => Buffer.from(JSON.stringify(input)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role, ref })}.not_a_real_signature`;
}

function response() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    setHeader(name: string, val: string) { this.headers[name] = val; return this; },
    json(body: unknown) { this.body = body; return this; },
    end() { return this; },
  };
  return res;
}

beforeEach(() => {
  ENV_NAMES.forEach((name) => vi.stubEnv(name, undefined));
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", PUBLIC_FIXTURE);
});
afterEach(() => vi.unstubAllEnvs());

describe("one GENEAI backend across web and API", () => {
  it("uses the canonical manifest when URLs are absent, accepting a trailing slash", () => {
    const fromManifest = resolvePublicBackendConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: PUBLIC_FIXTURE });
    const fromEnv = resolveServerBackendConfig({ SUPABASE_URL: `${identity.supabaseUrl}/`, SUPABASE_PUBLISHABLE_KEY: PUBLIC_FIXTURE });
    expect(fromEnv).toEqual(fromManifest);
    expect(fromManifest.authOrigin).toBe(`${identity.supabaseUrl}/auth/v1`);
  });

  it("stops a mixed deployment instead of sending a user's token to the old project", () => {
    expect(() => resolveServerBackendConfig({
      SUPABASE_URL: `https://${OLD_PROJECT}.supabase.co`,
      VITE_SUPABASE_URL: identity.supabaseUrl,
      SUPABASE_PUBLISHABLE_KEY: PUBLIC_FIXTURE,
    })).toThrowError(BackendConfigurationError);
    expect(() => resolvePublicBackendConfig({ VITE_SUPABASE_PROJECT_ID: OLD_PROJECT })).toThrowError(BackendConfigurationError);
  });

  it.each([
    `http://${identity.projectRef}.supabase.co`,
    `${identity.supabaseUrl}.example.com`,
    `https://login:password@${identity.projectRef}.supabase.co`,
    `${identity.supabaseUrl}/auth/v1`,
    `${identity.supabaseUrl}?project=another`,
  ])("rejects a credential destination that is not the allowlisted origin: %s", (url) => {
    expect(() => resolvePublicBackendConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: PUBLIC_FIXTURE }))
      .toThrowError(BackendConfigurationError);
  });

  it("never accepts privileged credentials in browser configuration", () => {
    for (const key of [SERVER_FIXTURE, legacyKey("service_role")]) {
      expect(() => resolvePublicBackendConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: key })).toThrowError(BackendConfigurationError);
      expect(() => resolveServerBackendConfig({ SUPABASE_PUBLISHABLE_KEY: key })).toThrowError(BackendConfigurationError);
    }
    expect(resolveServiceBackendConfig({ SUPABASE_SECRET_KEY: SERVER_FIXTURE }).secretKey).toBe(SERVER_FIXTURE);
  });

  it("rejects stale legacy keys even if a valid modern key is also configured", () => {
    expect(() => resolveServerBackendConfig({
      SUPABASE_PUBLISHABLE_KEY: PUBLIC_FIXTURE,
      SUPABASE_ANON_KEY: legacyKey("anon", OLD_PROJECT),
    })).toThrowError(BackendConfigurationError);
    expect(() => resolveServiceBackendConfig({ SUPABASE_SERVICE_ROLE_KEY: legacyKey("service_role", OLD_PROJECT) }))
      .toThrowError(BackendConfigurationError);
    expect(resolveServerBackendConfig({
      SUPABASE_PUBLISHABLE_KEY: PUBLIC_FIXTURE,
      SUPABASE_SERVICE_ROLE_KEY: legacyKey("service_role", OLD_PROJECT),
    }).projectRef).toBe(identity.projectRef);
    expect(resolvePublicBackendConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: legacyKey("anon") }).projectRef).toBe(identity.projectRef);
  });

  it("does not mistake a signed-in user token for a project API key", () => {
    expect(() => resolvePublicBackendConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: legacyKey("authenticated") }))
      .toThrowError(BackendConfigurationError);
    expect(() => resolveServiceBackendConfig({ SUPABASE_SERVICE_ROLE_KEY: legacyKey("anon") }))
      .toThrowError(BackendConfigurationError);
  });

  it("publishes matching health and OAuth identities without exposing credentials", () => {
    vi.stubEnv("GENEAI_PUBLIC_URL", "https://geneai.example.com");
    const healthRes = response();
    const oauthRes = response();
    health({}, healthRes);
    oauthMetadata({ method: "GET", headers: { host: "untrusted.example" } } as any, oauthRes as any);
    expect(healthRes.statusCode).toBe(200);
    expect(healthRes.body.backend).toEqual(identity);
    expect(oauthRes.body.authorization_servers).toEqual([healthRes.body.backend.authOrigin]);
    expect(oauthRes.body.resource).toBe("https://geneai.example.com/mcp");
    expect(JSON.stringify([healthRes.body, oauthRes.body])).not.toContain(PUBLIC_FIXTURE);
    expect(healthRes.headers["Cache-Control"]).toContain("no-store");
  });

  it("returns 503 when production has no verified public URL, even with a localhost Host header", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const host of ["untrusted.example", "localhost:3000"]) {
      const res = response();
      oauthMetadata({ method: "GET", headers: { host } } as any, res as any);
      expect(res.statusCode).toBe(503);
      expect(res.body.code).toBe("PUBLIC_APP_ORIGIN_MISSING");
      expect(res.body).not.toHaveProperty("resource");
      expect(res.body).not.toHaveProperty("authorization_servers");
    }
  });

  it("permits localhost discovery for development and rejects malformed configured public origins", () => {
    expect(getPublicAppOrigin({ headers: { host: "localhost:3000" } }, { NODE_ENV: "development" }))
      .toBe("http://localhost:3000");
    for (const origin of ["http://geneai.example.com", "https://geneai.example.com/path", "https://user:password@geneai.example.com"]) {
      expect(() => getPublicAppOrigin({ headers: {} }, { NODE_ENV: "production", GENEAI_PUBLIC_URL: origin }))
        .toThrowError(BackendConfigurationError);
    }
  });

  it("returns configuration failures as 503 without suggesting the user has signed out", () => {
    vi.stubEnv("SUPABASE_URL", `https://${OLD_PROJECT}.supabase.co`);
    const res = response();
    health({}, res);
    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ ok: false, code: "BACKEND_ORIGIN_MISMATCH" });
    expect(JSON.stringify(res.body)).not.toContain(PUBLIC_FIXTURE);
    const metadataRes = response();
    oauthMetadata({ method: "GET", headers: {} } as any, metadataRes as any);
    expect(metadataRes.statusCode).toBe(503);
    expect(metadataRes.body).not.toHaveProperty("authorization_servers");
  });
});
