import { Suspense } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { lazyView } from "./LazyView";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("keeps the rest of the app mounted after a Safari chunk failure", async () => {
  const Section = lazyView(async () => { throw new TypeError("Importing a module script failed."); });
  render(<><textarea aria-label="Borrador" defaultValue="nota pendiente" /><Suspense fallback={null}><Section /></Suspense></>);
  expect(await screen.findByRole("alert")).toHaveTextContent("Esta sección no terminó de cargar");
  expect(screen.getByRole("textbox")).toHaveValue("nota pendiente");
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  screen.getByRole("button", { name: "Volver a cargar" }).click();
  expect(confirm).toHaveBeenCalledOnce();
});
