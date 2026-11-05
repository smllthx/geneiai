import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import FanChart from "./FanChart";

it("prints every name in all six rings and opens the selected ancestor by keyboard", () => {
  const people = Array.from({ length: 7 }, (_, i) => ({
    id: String(i), nombres: `Maria Benedetta ${i}`, apellidos: "della Rovere Aeschlimann-Sanguineti",
    nac_fecha: "1865-09-08",
  }));
  const rels = people.slice(1).map(({ id }, i) => ({
    id, persona_id: String(i), pariente_id: id, tipo: "madre",
  }));
  const select = vi.fn();
  const { container } = render(<MemoryRouter><FanChart personas={people} rels={rels} centerId="0" generations={6} onSelect={select} /></MemoryRouter>);
  for (const p of people) {
    const slot = screen.getByRole("button", { name: `${p.nombres} ${p.apellidos}` });
    const visible = Array.from(slot.querySelectorAll("text tspan"), span => span.textContent).join(" ");
    expect(visible).toBe(`${p.nombres} ${p.apellidos} 1865–?`);
  }
  expect(container.querySelectorAll("path")).toHaveLength(126);
  fireEvent.keyDown(screen.getByRole("button", { name: /Maria Benedetta 6/ }), { key: "Enter" });
  expect(select).toHaveBeenCalledWith("6");
});
