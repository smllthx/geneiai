import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import AgentesParalelo from "./AgentesParalelo";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(async (_name: string, { body }: { body: { runId: string } }) =>
    body.runId === "3" ? { data: {}, error: new Error("Proveedor sin conexión") } : { data: { ok: true, text: "Respuesta" }, error: null }),
  researchTasks: vi.fn(async () => ({ error: null })),
}));
vi.mock("@/lib/peopleData", () => ({
  getActiveTreeId: async () => "tree-1",
  withTreeScope: (row: object, tree: string) => ({ ...row, arbol_id: tree }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    functions: { invoke: mocks.invoke },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }), removeChannel: vi.fn(),
    from: (table: string) => {
      if (table === "personas") return { select: () => ({ eq: () => ({ abortSignal: () => ({
        maybeSingle: async () => ({ data: { nombres: "Maria Rosa", apellidos: "Queirolo" } }),
      }) }) }) };
      if (table === "research_tasks") return { insert: mocks.researchTasks };
      return {
        select: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }),
        insert: (rows: object[]) => ({ select: async () => ({ data: rows.map((_, i) => ({ id: String(i) })) }) }),
      };
    },
  },
}));

it("prepares the selected person's four prompts and keeps a failed agent available to retry", async () => {
  render(<MemoryRouter initialEntries={["/investigacion?tab=paralelo&persona=person-1"]}><AgentesParalelo /></MemoryRouter>);
  const launch = await screen.findByRole("button", { name: "Lanzar 4 agentes en paralelo" });
  for (const prompt of document.querySelectorAll("textarea")) expect(prompt.value).toContain("Maria Rosa Queirolo");
  fireEvent.click(launch);
  await waitFor(() => expect(screen.getByText("4/4 · 3 correctos")).toBeInTheDocument());
  expect(mocks.invoke).toHaveBeenCalledTimes(4);
  expect(mocks.researchTasks).toHaveBeenCalledWith(Array(4).fill(expect.objectContaining({ person_id: "person-1", arbol_id: "tree-1" })));
  expect(screen.getByDisplayValue("Cronología")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Lanzar 1 agente en paralelo" })).toBeInTheDocument();
});
