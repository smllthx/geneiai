import canonical from "../config/geneai-backend.json" with { type: "json" };

export type BackendIdentity = {
  projectRef: string;
  supabaseUrl: string;
  authOrigin: string;
};

export type PublicBackendConfig = BackendIdentity & { publishableKey: string };
type Environment = Record<string, unknown>;

export class BackendConfigurationError extends Error {
  readonly status = 503;

  constructor(readonly code: string, message = "La configuración de GENEAI no coincide con su conexión compartida. Revisa la configuración del despliegue.") {
    super(message);
    this.name = "BackendConfigurationError";
  }
}

function value(input: unknown) {
  return typeof input === "string" ? input.trim() : "";
}

function hostedOrigin(input: unknown): string {
  try {
    const url = new URL(value(input));
    if (url.protocol !== "https:" || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname)
      || url.username || url.password || url.port || url.search || url.hash
      || url.pathname !== "/") throw new Error();
    return url.origin;
  } catch {
    throw new BackendConfigurationError("BACKEND_ORIGIN_INVALID");
  }
}

export function getCanonicalBackendIdentity(): BackendIdentity {
  const projectRef = value(canonical.projectRef);
  const supabaseUrl = hostedOrigin(canonical.supabaseUrl);
  if (!/^[a-z0-9]{20}$/.test(projectRef) || supabaseUrl !== `https://${projectRef}.supabase.co`) {
    throw new BackendConfigurationError("BACKEND_MANIFEST_INVALID");
  }
  return { projectRef, supabaseUrl, authOrigin: `${supabaseUrl}/auth/v1` };
}

function validateEnvironment(env: Environment): BackendIdentity {
  const identity = getCanonicalBackendIdentity();
  for (const name of ["SUPABASE_URL", "VITE_SUPABASE_URL"]) {
    if (value(env[name]) && hostedOrigin(env[name]) !== identity.supabaseUrl) {
      throw new BackendConfigurationError("BACKEND_ORIGIN_MISMATCH");
    }
  }
  for (const name of ["SUPABASE_PROJECT_ID", "SUPABASE_PROJECT_REF", "VITE_SUPABASE_PROJECT_ID"]) {
    if (value(env[name]) && value(env[name]) !== identity.projectRef) {
      throw new BackendConfigurationError("BACKEND_PROJECT_MISMATCH");
    }
  }
  return identity;
}

// Legacy key claims are only configuration checks. They NEVER authenticate a user;
// requests are verified by Supabase Auth against the allowlisted project.
function legacyKeyClaims(key: string): Record<string, unknown> | null {
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) return null;
  try {
    const encoded = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims: unknown = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
    return claims !== null && typeof claims === "object" && !Array.isArray(claims)
      ? claims as Record<string, unknown> : null;
  } catch { return null; }
}

function validateKey(key: string, identity: BackendIdentity, privileged = false) {
  const modernPrefix = privileged ? "sb_secret_" : "sb_publishable_";
  if (key.startsWith(modernPrefix) && /^[A-Za-z0-9_-]+$/.test(key.slice(modernPrefix.length))) return key;
  const claims = legacyKeyClaims(key);
  if (!claims || claims.role !== (privileged ? "service_role" : "anon")) {
    throw new BackendConfigurationError(privileged ? "BACKEND_SERVER_KEY_INVALID" : "BACKEND_PUBLIC_KEY_INVALID");
  }
  if (claims.ref !== identity.projectRef) throw new BackendConfigurationError("BACKEND_KEY_PROJECT_MISMATCH");
  return key;
}

export function resolvePublicBackendConfig(env: Environment = {}): PublicBackendConfig {
  const identity = validateEnvironment(env);
  const configured = value(env.VITE_SUPABASE_PUBLISHABLE_KEY);
  const publishableKey = validateKey(configured || value(canonical.publishableKey), identity);
  return { ...identity, publishableKey };
}

export function resolveServerBackendConfig(env: Environment = {}): PublicBackendConfig {
  const identity = validateEnvironment(env);
  const keys = ["SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]
    .map((name) => value(env[name])).filter(Boolean);
  // Validate every supplied key so a stale legacy setting is not silently masked.
  keys.forEach((key) => validateKey(key, identity));
  // User-scoped requests use only a public key and the caller's verified token.
  // Privileged credentials are checked separately by resolveServiceBackendConfig.
  const publishableKey = keys[0] || validateKey(value(canonical.publishableKey), identity);
  return { ...identity, publishableKey };
}

export function resolveServiceBackendConfig(env: Environment = {}) {
  const identity = validateEnvironment(env);
  const keys = ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
    .map((name) => value(env[name])).filter(Boolean);
  if (!keys.length) {
    throw new BackendConfigurationError("BACKEND_SERVER_KEY_MISSING", "El acceso privado de GENEAI Work no está configurado en el servidor.");
  }
  keys.forEach((key) => validateKey(key, identity, true));
  return { ...identity, secretKey: keys[0] };
}
