import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import DashboardView, { type DashboardProps } from "./DashboardView";

const data: DashboardProps = { stats: { personas: 0, lugares: 0, fotos: 0, totalApellidos: 0, docsPendientes: 0, coincidencias: 0, hipotesis: 0, inferencias: 0, apellidos: [] }, recientes: [], vistasRecientes: [], sinPadres: [], sinFotos: [], actividad: [] };
afterEach(cleanup);
function Destination() { const location = useLocation(); return <p data-testid="destination">{location.pathname}{location.search}</p>; }
function show(props: Partial<DashboardProps> = {}) {
  render(<MemoryRouter initialEntries={["/inicio"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/inicio" element={<DashboardView {...data} {...props} />} /><Route path="/buscar" element={<Destination />} /><Route path="/arbol" element={<Destination />} /></Routes></MemoryRouter>);
}
it("submits the actual search text and preserves special characters", () => {
  show();
  fireEvent.change(screen.getByLabelText("Buscar en tu archivo familiar"), { target: { value: "  María Ríos & Vega  " } });
  fireEvent.submit(screen.getByRole("search"));
  expect(screen.getByTestId("destination")).toHaveTextContent("/buscar?q=Mar%C3%ADa%20R%C3%ADos%20%26%20Vega");
});
it("does not present zero pending records as a successful empty state while loading or failed", () => {
  show({ loading: true });
  expect(screen.queryByText("Un nuevo descubrimiento.")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Resumen del archivo")).toHaveTextContent("—");
  cleanup();
  show({ loadError: true });
  expect(screen.queryByText("Un nuevo descubrimiento.")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
});
it("opens the tree directly without nesting interactive links", () => {
  show();
  expect(document.querySelector("a a")).toBeNull();
  fireEvent.click(screen.getByRole("link", { name: "Explorar árbol" }));
  expect(screen.getByTestId("destination")).toHaveTextContent("/arbol");
});
