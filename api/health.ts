import { BackendConfigurationError, resolveServerBackendConfig } from "../shared/backendIdentity.js";

export default function handler(_req: any, res: any) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    const { projectRef, supabaseUrl, authOrigin } = resolveServerBackendConfig(process.env);
    return res.status(200).json({
      ok: true,
      service: "GENEAI",
      backend: { projectRef, supabaseUrl, authOrigin },
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      service: "GENEAI",
      code: error instanceof BackendConfigurationError ? error.code : "BACKEND_UNAVAILABLE",
      error: "No se pudo validar la conexión compartida de GENEAI.",
    });
  }
}
