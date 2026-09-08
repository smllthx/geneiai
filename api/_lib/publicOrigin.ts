import { BackendConfigurationError } from "../../shared/backendIdentity.js";

export function getPublicAppOrigin(req: { headers: Record<string, unknown> }, env: Record<string, unknown> = process.env) {
  const configured = typeof env.GENEAI_PUBLIC_URL === "string" ? env.GENEAI_PUBLIC_URL.trim() : "";
  if (configured) {
    try {
      const url = new URL(configured);
      const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
      if ((url.protocol !== "https:" && !(local && url.protocol === "http:"))
        || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error();
      return url.origin;
    } catch { throw new BackendConfigurationError("PUBLIC_APP_ORIGIN_INVALID"); }
  }
  const rawHost = req.headers["x-forwarded-host"] ?? req.headers.host;
  if (env.NODE_ENV !== "production" && typeof rawHost === "string"
    && /^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/.test(rawHost)) return `http://${rawHost}`;
  throw new BackendConfigurationError("PUBLIC_APP_ORIGIN_MISSING");
}
