import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error módulo JS del compañero local
import { createServer } from "../src/server.js";

/** Smoke test sin credenciales y sin navegador: se inyectan herramientas simuladas. */
const fakeTools = {
  familysearch_browser_open: async () => ({ ok: true, status: "login_required" }),
  familysearch_browser_status: async () => ({ ok: true, status: "closed", logged_in: false }),
  familysearch_browser_search_people: async (args: { nombre?: string }) =>
    args?.nombre ? { ok: true, results: [] } : { ok: false, status: "invalid_input" },
  familysearch_browser_get_person: async () => ({ ok: false, status: "login_required" }),
  familysearch_browser_get_sources: async () => ({ ok: false, status: "login_required" }),
  familysearch_browser_logout: async () => ({ ok: true, logged_out: true }),
};

let base = "";
let server: ReturnType<typeof createServer>;

beforeAll(async () => {
  server = createServer(fakeTools);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("servidor local", () => {
  it("GET /health lista las 6 herramientas", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.tools).toEqual([
      "familysearch_browser_open",
      "familysearch_browser_status",
      "familysearch_browser_search_people",
      "familysearch_browser_get_person",
      "familysearch_browser_get_sources",
      "familysearch_browser_logout",
    ]);
  });

  it("GET / devuelve la UI local", async () => {
    const res = await fetch(`${base}/`);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("Compañero local de FamilySearch");
  });

  it("POST a una herramienta devuelve su resultado", async () => {
    const res = await fetch(`${base}/tools/familysearch_browser_status`, { method: "POST", body: "{}" });
    expect(await res.json()).toMatchObject({ ok: true, status: "closed" });
  });

  it("valida entrada de búsqueda", async () => {
    const res = await fetch(`${base}/tools/familysearch_browser_search_people`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(await res.json()).toMatchObject({ status: "invalid_input" });
  });

  it("404 en herramienta desconocida", async () => {
    const res = await fetch(`${base}/tools/nope`, { method: "POST", body: "{}" });
    expect(res.status).toBe(404);
  });

  it("400 con JSON inválido", async () => {
    const res = await fetch(`${base}/tools/familysearch_browser_status`, { method: "POST", body: "{no-json" });
    expect(res.status).toBe(400);
  });
});
