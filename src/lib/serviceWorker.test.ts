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
  runInNewContext(source.replace("__GENEAI_DEPLOYMENT_ORIGIN__", "https://geneiai-frozen-geneaia.vercel.app"), context);
});

it("never intercepts account data, health checks, authenticated files or writes", () => {
  for (const request of [
    new Request("https://data.supabase.co/rest/v1/personas"),
    new Request("https://geneai.example/api/health"),
    new Request("https://geneai.example/api/data", { method: "POST" }),
    new Request("https://geneai.example/assets/private.png", { headers: { Authorization: "Bearer example" } }),
  ]) {
    const respondWith = vi.fn();
    handlers.fetch({ request, respondWith, waitUntil: vi.fn() });
    expect(respondWith).not.toHaveBeenCalled();
  }
  expect(context.caches.open).not.toHaveBeenCalled();
});

it("serves a fingerprinted asset without fetching it a second time", async () => {
  const request = new Request("https://geneai.example/assets/index-abc123.js");
  let pending: Promise<Response>;
  const respondWith = (response: Promise<Response>) => { pending = response; };
  handlers.fetch({ request, respondWith, waitUntil: vi.fn() });
  expect(await (await pending!).text()).toBe("bundle");
  handlers.fetch({ request, respondWith, waitUntil: vi.fn() });
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

it("recovers a previous tab's public module from its own deployment without forwarding cookies or query strings", async () => {
  const request = new Request("https://geneai.example/assets/Personas-abc12345.js?debug=1");
  context.fetch.mockResolvedValueOnce(new Response("SPA", { headers: { "Content-Type": "text/html" } }))
    .mockResolvedValueOnce(new Response("export default 1", { headers: { "Content-Type": "application/javascript" } }));
  let response!: Promise<Response>;
  const waitUntil = vi.fn();
  handlers.fetch({ request, respondWith: (value: Promise<Response>) => { response = value; }, waitUntil });
  expect(await (await response).text()).toBe("export default 1");
  expect(context.fetch).toHaveBeenLastCalledWith("https://geneiai-frozen-geneaia.vercel.app/assets/Personas-abc12345.js", {
    mode: "cors", credentials: "omit", redirect: "error",
  });
  await waitUntil.mock.calls[0][0];
  expect(await entries.get(request.url)?.text()).toBe("export default 1");
});

it("delivers modules with denied CacheStorage or when a cache write never settles", async () => {
  const request = new Request("https://geneai.example/assets/App-abc12345.js");
  context.caches.open.mockRejectedValueOnce(new Error("SecurityError"));
  let response!: Promise<Response>;
  const deliver = (value: Promise<Response>) => { response = value; };
  handlers.fetch({ request, respondWith: deliver, waitUntil: vi.fn() });
  expect(await (await response).text()).toBe("bundle");
  const cache = await context.caches.open();
  cache.put.mockImplementation(() => new Promise(() => {}));
  handlers.fetch({ request, respondWith: deliver, waitUntil: vi.fn() });
  expect(await (await response).text()).toBe("bundle");
});

it("keeps deep links in the SPA and missing resources out of it", () => {
  const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
  const fallback = config.rewrites.find((rule: { destination: string }) => rule.destination === "/index.html");
  const matcher = new RegExp(`^${fallback.source}$`);
  for (const pathname of ["/", "/arbol", "/personas/demo/ficha"]) expect(matcher.test(pathname)).toBe(true);
  for (const pathname of ["/assets/Old-abc12345.js", "/assets/font.woff2", "/api/missing", "/.well-known/missing", "/nonexistent.svg"]) expect(matcher.test(pathname)).toBe(false);
});
