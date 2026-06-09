import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Arbol from "./Arbol";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "test@geneai.local" } }),
}));

vi.mock("@/hooks/use-realtime-reload", () => ({
  useRealtimeReload: () => 0,
}));

vi.mock("@/lib/recent", () => ({
  getRecent: () => [],
}));

vi.mock("@/components/TreeInsights", () => ({
  default: () => null,
}));

vi.mock("@/components/QuickAddRelative", () => ({
  default: ({ trigger }: any) => trigger ?? null,
}));

vi.mock("@/lib/peopleData", () => ({
  getActiveTreeId: vi.fn(async () => "tree-1"),
  fetchAllPeople: vi.fn(async () => []),
  fetchAllRelations: vi.fn(async () => []),
  withTreeScope: vi.fn((row) => row),
  applyTreeScope: vi.fn(async () => ({ data: [] })),
}));

const chain = {
  select: vi.fn(() => chain),
  eq: vi.fn(() => chain),
  maybeSingle: vi.fn(async () => ({ data: { proband_id: null }, error: null })),
  limit: vi.fn(async () => ({ data: [], error: null })),
  order: vi.fn(() => chain),
  insert: vi.fn(async () => ({ data: [], error: null })),
  update: vi.fn(() => chain),
  delete: vi.fn(() => chain),
  in: vi.fn(async () => ({ data: [], error: null })),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
    },
    from: vi.fn(() => chain),
    functions: {
      invoke: vi.fn(async () => ({ data: {}, error: null })),
    },
  },
}));

describe("Arbol", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carga la vista de arbol vacia sin lanzar excepciones", async () => {
    render(
      <MemoryRouter initialEntries={["/arbol"]}>
        <Arbol />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Árbol" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Selecciona una persona o crea la primera/i)).toBeInTheDocument();
    });
  });
});
