// Match complete redirect URIs. OAuth client display names are self-reported.
export function mcpClientForCallback(uri: string) {
  if (uri === "https://claude.ai/api/mcp/auth_callback" || uri === "https://claude.com/api/mcp/auth_callback") return "Claude";
  if (uri === "https://chatgpt.com/connector_platform_oauth_redirect"
    || /^https:\/\/chatgpt\.com\/connector\/oauth\/[A-Za-z0-9_-]{8,200}$/.test(uri)) return "ChatGPT";
  return null;
}
