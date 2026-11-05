import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import CuadrosIA from "./CuadrosIA";

const records = vi.hoisted(() => [
  { id: "p1", nombres: "Alba", apellidos: "Rojas", lugar: { ciudad: "Valparaíso", pais: "Chile" } },
  { id: "p2", nombres: "María", apellidos: "Vega" },
]);
const actions = vi.hoisted(() => ({ generatePersonPoster: vi.fn(), downloadPersonPoster: vi.fn() }));
vi.mock("@/lib/personPoster", () => actions);
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: records }) }) }) }),
} }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("generates for the selected person, enables exports and clears the prior preview on selection", async () => {
  actions.generatePersonPoster.mockResolvedValue("data:image/png;base64,aW1hZ2U=");
  actions.downloadPersonPoster.mockResolvedValue(undefined);
  render(<MemoryRouter><CuadrosIA /></MemoryRouter>);
  await screen.findByRole("button", { name: /Alba Rojas/ });
  expect(screen.getByRole("button", { name: "PDF" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Generar cuadro" }));
  await screen.findByAltText("Cuadro genealógico generado");
  expect(actions.generatePersonPoster).toHaveBeenCalledWith("p1");
  fireEvent.click(screen.getByRole("button", { name: "PDF" }));
  expect(actions.downloadPersonPoster).toHaveBeenCalledWith("data:image/png;base64,aW1hZ2U=", "p1", "pdf");
  fireEvent.click(screen.getByRole("button", { name: /María Vega/ }));
  await waitFor(() => expect(screen.queryByAltText("Cuadro genealógico generado")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "PNG" })).toBeDisabled();
});
