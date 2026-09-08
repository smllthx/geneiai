// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { beforeEach, expect, it, vi } from "vitest";

const source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
let handlers: Record<string, (event: any) => void>;
let context: any;
let entries: Map<string, Response>;
beforeEach(() => {
  handlers = {};
  entries = new Map();
  const cache = {
    match: vi.fn(async (request: Request | string) => entries.get(typeof request === "string" ? request : request.url)?.clone()),
    put: vi.fn(async (request: Request, response: Response) => { entries.set(request.url, response); }),
    keys: vi.fn(async () => [...entries.keys()]), delete: vi.fn(), addAll: vi.fn().mockResolvedValue(undefined),
  };
  context = {
    URL, Response, Headers,
    fetch: vi.fn(async () => new Response("bundle", { headers: { "Content-Type": "text/javascript" } })),
    caches: { open: vi.fn(async () => cache), keys: vi.fn(async () => ["geneai-pwa-v4-api", "geneai-pwa-v4-images", "unrelated-cache"]), delete: vi.fn() },
    self: { location: { origin: "https://geneai.example" }, addEventListener: (type: string, handler: (event: any) => void) => { handlers[type] = handler; }, skipWaiting: vi.fn(), clients: { claim: vi.fn() } },
  };
  runInNewContext(source, context);
});

it("never intercepts account data, health checks, authenticated files or writes", () => {
  for (const request of [
    new Request("https://data.supabase.co/rest/v1/personas"),
    new Request("https://geneai.example/api/health"),
    new Request("https://geneai.example/api/data", { method: "POST" }),
    new Request("https://geneai.example/assets/private.png", { headers: { Authorization: "Bearer example" } }),
  ]) {
    const respondWith = vi.fn();
    handlers.fetch({ request, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
  }
  expect(context.caches.open).not.toHaveBeenCalled();
});

it("serves a fingerprinted asset without fetching it a second time", async () => {
  const request = new Request("https://geneai.example/assets/index-abc123.js");
  let pending: Promise<Response>;
  const respondWith = (response: Promise<Response>) => { pending = response; };
  handlers.fetch({ request, respondWith });
  expect(await (await pending!).text()).toBe("bundle");
  handlers.fetch({ request, respondWith });
  expect(await (await pending!).text()).toBe("bundle");
  expect(context.fetch).toHaveBeenCalledTimes(1);
});

it("waits for explicit update and deletes legacy account caches on activation", async () => {
  let pending: Promise<unknown>;
  const waitUntil = (promise: Promise<unknown>) => { pending = promise; };
  handlers.install({ waitUntil });
  await pending!;
  expect(context.self.skipWaiting).not.toHaveBeenCalled();
  handlers.message({ data: { type: "SKIP_WAITING" } });
  expect(context.self.skipWaiting).toHaveBeenCalledTimes(1);
  handlers.activate({ waitUntil });
  await pending!;
  expect(context.caches.delete).toHaveBeenCalledWith("geneai-pwa-v4-api");
  expect(context.caches.delete).toHaveBeenCalledWith("geneai-pwa-v4-images");
  expect(context.caches.delete).not.toHaveBeenCalledWith("unrelated-cache");
});

it("shows the public offline page when opening a deep link without a connection", async () => {
  context.fetch.mockRejectedValue(new Error("offline"));
  entries.set("/offline.html", new Response("GENEAI sin conexión"));
  let pending: Promise<Response>;
  handlers.fetch({ request: { url: "https://geneai.example/personas/123", method: "GET", mode: "navigate", headers: new Headers() }, respondWith: (promise: Promise<Response>) => { pending = promise; } });
  expect(await (await pending!).text()).toBe("GENEAI sin conexión");
});
