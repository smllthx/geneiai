// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import biography from "../ai/biography";
import extract from "../ai/extract";
import relations from "../ai/suggest-relations";

const person = { id: "person-A", nombres: "Maria", apellidos: "Queirolo", arbol_id: "tree-A" };
const userId = "fixture-account";
const routes = [
  { name: "biography", handler: biography, body: { person_id: person.id }, answer: { biography_text: "Maria figura en el archivo." }, table: "ai_biographies" },
  { name: "extract", handler: extract, body: { document_id: "doc-A" }, answer: { summary: "Acta de nacimiento", names: [{ full_name: "Maria Queirolo" }] }, table: "document_ai_data" },
  { name: "suggest-relations", handler: relations, body: { person_id: person.id }, answer: { suggestions: [{ suggestion_type: "relacion", evidence: "Acta de nacimiento" }] }, table: "ai_suggestions" },
];

function reply() {
  return { code: 0, body: {} as Record<string, unknown>, status(code: number) { this.code = code; return this; },
    setHeader: vi.fn(), end(value: string) { this.body = JSON.parse(value); } };
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each(routes)("authenticates $name, calls the provider and saves the result for the verified user's tree", async ({ handler, body, answer, table }) => {
  // All remote I/O is intercepted, including Auth, PostgREST and OpenAI.
  vi.stubEnv("OPENAI_API_KEY", "synthetic-key");
  const writes = new Map<string, Record<string, unknown>[]>();
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    calls.push(url.pathname);
    if (url.hostname === "api.openai.com") {
      expect(req.headers.get("Authorization")).toBe("Bearer synthetic-key");
      expect((await req.json()).messages).toEqual(expect.arrayContaining([expect.objectContaining({ role: "user" })]));
      return Response.json({ choices: [{ message: { content: JSON.stringify(answer) } }] });
    }
    expect(req.headers.get("Authorization")).toBe("Bearer synthetic-session");
    if (url.pathname === "/auth/v1/user") return Response.json({ id: userId, aud: "authenticated" });
    const entity = url.pathname.split("/").pop()!;
    if (req.method === "GET" && ["personas", "relaciones", "eventos", "documentos"].includes(entity)) {
      expect(url.searchParams.getAll("or")).toContain("(arbol_id.eq.tree-A,arbol_id.is.null)");
    }
    let rows: unknown[] = [];
    if (req.method === "POST") {
      const payload = await req.json();
      rows = Array.isArray(payload) ? payload : [payload];
      writes.set(entity, rows as Record<string, unknown>[]);
    } else if (entity === "profiles") {
      expect(url.searchParams.get("id")).toBe("eq." + userId);
      rows = [{ active_arbol_id: "tree-A" }];
    } else if (entity === "personas") rows = [person];
    else if (entity === "documentos") rows = [{ id: "doc-A", titulo: "Acta", transcripcion: "Maria Queirolo nació en Rapallo." }];
    else if (entity === "app_config") rows = [{ openai_api_key: null }];
    return Response.json(req.headers.get("Accept")?.includes("pgrst.object") ? rows[0] : rows);
  }));
  const res = reply();
  await handler({ method: "POST", headers: { authorization: "Bearer synthetic-session" }, body }, res);
  expect(res.body).toMatchObject({ ok: true });
  expect(res.code).toBe(200);
  expect(calls[0]).toBe("/auth/v1/user");
  expect(calls.filter(path => path === "/v1/chat/completions")).toHaveLength(1);
  expect(writes.get(table)).toEqual([expect.objectContaining({ user_id: userId, arbol_id: "tree-A" })]);
});

it.each(routes)("rejects an anonymous $name request before accessing data or the provider", async ({ handler, body }) => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const res = reply();
  await handler({ method: "POST", body, headers: {} }, res);
  expect(res.code).toBe(401);
  expect(fetch).not.toHaveBeenCalled();
});
