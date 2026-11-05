import { describe, expect, it } from "vitest";
import { mcpClientForCallback } from "./mcpCallback";

describe("official MCP OAuth callbacks", () => {
  it.each([
    ["https://claude.ai/api/mcp/auth_callback", "Claude"],
    ["https://claude.com/api/mcp/auth_callback", "Claude"],
    ["https://chatgpt.com/connector_platform_oauth_redirect", "ChatGPT"],
    ["https://chatgpt.com/connector/oauth/aB0_123-x", "ChatGPT"],
  ])("recognizes %s", (uri, client) => expect(mcpClientForCallback(uri)).toBe(client));
  it.each([
    "http://claude.ai/api/mcp/auth_callback", "https://claude.ai.evil.test/api/mcp/auth_callback",
    "https://chatgpt.com/connector/oauth/short", "https://evil@chatgpt.com/connector/oauth/12345678",
    "https://claude.ai/api/mcp/auth_callback?next=https://example.org",
    "https://chatgpt.com:8443/connector/oauth/12345678", "https://chatgpt.com/connector/oauth/12345678/extra",
  ])("rejects %s", uri => expect(mcpClientForCallback(uri)).toBeNull());
});
