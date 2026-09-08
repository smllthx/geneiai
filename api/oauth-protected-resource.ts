import type { IncomingMessage, ServerResponse } from "node:http";
import { BackendConfigurationError, resolveServerBackendConfig } from "../shared/backendIdentity.js";
import { getPublicAppOrigin } from "./_lib/publicOrigin.js";

type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => ApiResponse;
};

export default function handler(req: IncomingMessage, res: ApiResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    return res.status(204).end();
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    const { authOrigin } = resolveServerBackendConfig(process.env);
    const appOrigin = getPublicAppOrigin(req);
    return res.status(200).json({
      resource: `${appOrigin}/mcp`,
      authorization_servers: [authOrigin],
      bearer_methods_supported: ["header"],
      scopes_supported: ["openid", "profile", "email"],
      resource_documentation: `${appOrigin}/configuracion`,
    });
  } catch (error) {
    return res.status(503).json({
      error: "oauth_not_configured",
      code: error instanceof BackendConfigurationError ? error.code : "BACKEND_UNAVAILABLE",
    });
  }
}
