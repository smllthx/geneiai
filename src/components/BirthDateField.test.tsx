import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import BirthDateField from "./BirthDateField";

it("changes precision only when a new date is entered", () => {
  const onChange = vi.fn();
  render(<BirthDateField person={{ nac_fecha: "1901-05-04" }} onChange={onChange} />);
  expect(screen.getByLabelText("Fecha exacta de nacimiento")).toHaveValue("1901-05-04");
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "approx" } });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Fecha aproximada de nacimiento"), { target: { value: "hacia 1900" } });
  expect(onChange).toHaveBeenCalledWith({ nac_fecha: null, nac_fecha_aprox: "hacia 1900", nac_rango_ini: null, nac_rango_fin: null });
});
