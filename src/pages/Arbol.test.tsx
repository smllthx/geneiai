import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAllPeople, fetchAllRelations } from "@/lib/peopleData";
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

it("recovers a failed tree load instead of spinning forever", async () => {
  vi.mocked(fetchAllPeople).mockRejectedValueOnce(new Error("Conexión interrumpida"));
  render(<MemoryRouter initialEntries={["/arbol"]}><Arbol /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Conexión interrumpida');
  expect(screen.queryByText('Cargando árbol…')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});

it('renders connected unequal ancestor branches in Retrato and Ramas, and keeps the selected person at the root', async () => {
  vi.mocked(fetchAllPeople).mockResolvedValueOnce([
    { id: 'child', nombres: 'Elena', apellidos: 'Ejemplo', sexo: 'femenino' },
    { id: 'father', nombres: 'Antonio', apellidos: 'Ejemplo', sexo: 'masculino' },
    { id: 'mother', nombres: 'Isabel', apellidos: 'Ejemplo', sexo: 'femenino' },
    { id: 'grandfather', nombres: 'Rafael', apellidos: 'Ejemplo', sexo: 'masculino' },
    { id: 'grandmother', nombres: 'Mariana', apellidos: 'Ejemplo', sexo: 'femenino' },
  ]);
  vi.mocked(fetchAllRelations).mockResolvedValueOnce([
    { id: '1', persona_id: 'child', pariente_id: 'father', tipo: 'padre' },
    { id: '2', persona_id: 'child', pariente_id: 'mother', tipo: 'madre' },
    { id: '3', persona_id: 'father', pariente_id: 'grandfather', tipo: 'padre' },
    { id: '4', persona_id: 'father', pariente_id: 'grandmother', tipo: 'madre' },
  ]);
  const { container } = render(<MemoryRouter initialEntries={['/arbol?centro=child']}><Arbol /></MemoryRouter>);
  await waitFor(() => expect(container.querySelectorAll('[data-family-node][data-person-id]')).toHaveLength(5));
  const links = () => [...container.querySelectorAll('[data-family-link]')].map(edge => `${edge.getAttribute('data-parent-id')}:${edge.getAttribute('data-child-id')}`).sort();
  expect(links()).toEqual(['father:child', 'grandfather:father', 'grandmother:father', 'mother:child']);
  const father = container.querySelector<HTMLElement>('[data-family-node][data-person-id="father"]')!;
  const mother = container.querySelector<HTMLElement>('[data-family-node][data-person-id="mother"]')!;
  expect(father.style.top).toBe(mother.style.top);
  expect(container.querySelector('[data-family-node="center"]')).toHaveAttribute('data-person-id', 'child');
  const reads = vi.mocked(fetchAllPeople).mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Ramas' }));
  expect(links()).toEqual(['father:child', 'grandfather:father', 'grandmother:father', 'mother:child']);
  expect(fetchAllPeople).toHaveBeenCalledTimes(reads);
});
