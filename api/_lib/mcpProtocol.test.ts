// @vitest-environment node
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, expect, it, vi } from "vitest";
import handler from "../mcp";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("negotiates MCP over HTTP, reads an owned tree, and rejects further calls after revocation", async () => {
  const userId = "10000000-0000-4000-8000-000000000001";
  const treeId = "20000000-0000-4000-8000-000000000002";
  const clientId = "test-connector";
  const token = `header.${Buffer.from(JSON.stringify({ client_id: clientId })).toString("base64url")}.fixture`;
  const networkFetch = globalThis.fetch;
  let approved = true;
  let treeReads = 0;
  vi.stubEnv("GENEAI_WORK_CLIENT_IDS", clientId);
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test_fixture");
  vi.stubEnv("GENEAI_PUBLIC_URL", "https://geneiai.vercel.app");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const { pathname, searchParams } = new URL(req.url);
    if (pathname === "/auth/v1/user") {
      expect(req.headers.get("authorization")).toBe("Bearer " + token);
      return Response.json({ id: userId, aud: "authenticated" });
    }
    let rows: Record<string, unknown>[];
    switch (pathname) {
      case "/rest/v1/work_oauth_clients":
        expect(Object.fromEntries(searchParams)).toMatchObject({ user_id: "eq." + userId, client_id: "eq." + clientId, active: "eq.true" });
        rows = approved ? [{ id: "approval" }] : [];
        break;
      case "/rest/v1/arboles":
        expect(searchParams.get("user_id")).toBe("eq." + userId);
        treeReads++;
        rows = [{ id: treeId, nombre: "Árbol sintético" }];
        break;
      case "/rest/v1/profiles":
        expect(searchParams.get("id")).toBe("eq." + userId);
        rows = [{ active_arbol_id: treeId }];
        break;
      default: throw new Error("Unexpected backend request: " + pathname);
    }
    return Response.json(req.headers.get("accept")?.includes("pgrst.object") ? rows[0] ?? null : rows);
  }));

  // Supply the JSON-body and status helpers Vercel normally attaches to Node HTTP.
  const methods: string[] = [];
  const http = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
    if (body?.method) methods.push(body.method);
    const response = Object.assign(res, {
      status(code: number) { res.statusCode = code; return response; },
      json(value: unknown) { res.setHeader("Content-Type", "application/json"); return res.end(JSON.stringify(value)); },
    });
    await handler(Object.assign(req, { body }), response);
  });
  await new Promise<void>(resolve => http.listen(0, "127.0.0.1", resolve));
  const url = new URL(`http://127.0.0.1:${(http.address() as AddressInfo).port}/mcp`);
  const client = new Client({ name: "test-assistant", version: "1.0.0" });
  try {
    const transport = new StreamableHTTPClientTransport(url, { fetch: networkFetch, requestInit: { headers: { Authorization: `Bearer ${token}` } } });
    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.map(tool => tool.name)).toEqual(expect.arrayContaining(["search", "fetch", "list_trees"]));
    const result = await client.callTool({ name: "list_trees", arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ result: { activeTreeId: treeId, trees: [{ id: treeId, nombre: "Árbol sintético", active: true }] } });
    expect(methods).toEqual(expect.arrayContaining(["initialize", "notifications/initialized", "tools/list", "tools/call"]));
    approved = false;
    await expect(client.callTool({ name: "list_trees", arguments: {} })).rejects.toMatchObject({ code: 403 });
    expect(treeReads).toBe(1);
  } finally {
    await client.close();
    http.closeAllConnections();
    await new Promise<void>(resolve => http.close(() => resolve()));
  }
});
