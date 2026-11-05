// @vitest-environment node
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
import { openAIJson } from "./geneai";
import handler from "../mcp";

const client = {
  from: () => ({ select: () => ({ maybeSingle: async () => ({ data: { openai_api_key: "test-only" } }) }) }),
} as unknown as SupabaseClient;

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each([
  "",
  "a raw response containing private data",
  JSON.stringify({ choices: [] }),
  ...["{}", "[]", "null", "invalid", " "].map(content => JSON.stringify({ choices: [{ message: { content } }] })),
  JSON.stringify({ choices: [{ finish_reason: "length", message: { content: '{"incomplete":true}' } }] }),
])("rejects empty, truncated or malformed AI output %#", async raw => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(raw)));
  await expect(openAIJson(client, [], "{}")).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE", status: 502 });
});

it.each([[401, "AI_KEY_REJECTED"], [429, "AI_LIMIT"], [500, "AI_PROVIDER_ERROR"]])("hides private provider diagnostics on HTTP %s", async (status, code) => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("sensitive fixture", { status: Number(status) })));
  const error = await openAIJson(client, [], "{}").catch(e => e);
  expect(error.code).toBe(code);
  expect(error.message).not.toContain("sensitive fixture");
});

it.each([
  ["https://geneiai.vercel.app", 204],
  ["https://claude.ai", 204],
  ["https://chatgpt.com", 204],
  ["https://chatgpt.com.untrusted.invalid", 403],
  ["null", 403],
  [undefined, 204],
] as const)("validates MCP preflight origin %s", async (origin, expected) => {
  vi.stubEnv("GENEAI_PUBLIC_URL", "https://geneiai.vercel.app");
  const response = {
    setHeader: vi.fn(), status: vi.fn().mockReturnThis(), end: vi.fn(), json: vi.fn(),
  };
  await handler({ method: "OPTIONS", headers: { origin } } as Parameters<typeof handler>[0], response as unknown as Parameters<typeof handler>[1]);
  expect(response.status).toHaveBeenCalledWith(expected);
  if (origin && expected === 204) {
    expect(response.setHeader).toHaveBeenCalledWith("Access-Control-Allow-Origin", origin);
    expect(response.setHeader).toHaveBeenCalledWith("Access-Control-Allow-Headers", expect.stringContaining("mcp-protocol-version"));
  } else {
    expect(response.setHeader).not.toHaveBeenCalledWith("Access-Control-Allow-Origin", expect.anything());
  }
});
