import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it } from "vitest";
import GeneTimeline from "./GeneTimeline";
import { buildTimeline } from "@/lib/timeline";

afterEach(cleanup);
beforeEach(() => localStorage.clear());
const items = buildTimeline([{ id: "p", nombres: "Elena", apellidos: "Ríos", nac_fecha_aprox: "ABT 1865" }], [
  { id: "e", persona_id: "p", tipo: "matrimonio", fecha: "1890-09-08", fuente_id: "doc-1", lugar_original: "Rapallo, Italia", descripcion: "Transcripción original" },
]);
it("opens real event details, retains the selection across layouts and links to its source", () => {
  render(<MemoryRouter><GeneTimeline items={items} showPeople /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: /Matrimonio/ }));
  expect(screen.getByRole("region", { name: "Detalle del evento" })).toHaveTextContent("Transcripción original");
  expect(screen.getByRole("link", { name: "Abrir fuente" })).toHaveAttribute("href", "/documentos/doc-1");
  fireEvent.click(screen.getByRole("button", { name: "Horizontal" }));
  expect(screen.getAllByRole("region", { name: "Detalle del evento" })).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Horizontal" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
  expect(screen.queryByRole("region", { name: "Detalle del evento" })).not.toBeInTheDocument();
});
it("filters by person and event type without inventing empty facts", () => {
  render(<MemoryRouter><GeneTimeline items={items} showPeople filters /></MemoryRouter>);
  fireEvent.change(screen.getByRole("combobox", { name: "Evento" }), { target: { value: "nacimiento" } });
  fireEvent.click(screen.getByRole("button", { name: /Nacimiento/ }));
  const detail = screen.getByRole("region", { name: "Detalle del evento" });
  expect(detail).toHaveTextContent("hacia 1865");
  expect(within(detail).queryByRole("link", { name: "Abrir fuente" })).toBeNull();
  expect(detail).toHaveTextContent("Sin fuente vinculada");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nobody" } });
  expect(screen.queryByRole("region", { name: "Detalle del evento" })).toBeNull();
  expect(screen.getByText("No hay eventos que coincidan.")).toBeVisible();
});
