import type { IncomingMessage, ServerResponse } from "node:http";

type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => ApiResponse;
};

function publicOrigin(req: IncomingMessage) {
  const configured = (process.env.GENEAI_PUBLIC_URL ?? "").trim().replace(/\/$/, "");
  if (configured) return configured;

  const rawHost = req.headers["x-forwarded-host"] ?? req.headers.host;
  const host = Array.isArray(rawHost) ? rawHost[0] : rawHost;
  if (host?.startsWith("localhost") || host?.startsWith("127.0.0.1")) return `http://${host}`;
  return "https://geneiai.vercel.app";
}

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

  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  if (!supabaseUrl) return res.status(503).json({ error: "oauth_not_configured" });

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
  return res.status(200).json({
    resource: `${publicOrigin(req)}/mcp`,
    authorization_servers: [`${supabaseUrl}/auth/v1`],
    bearer_methods_supported: ["header"],
    scopes_supported: ["openid", "profile", "email"],
    resource_documentation: `${publicOrigin(req)}/configuracion`,
  });
}
