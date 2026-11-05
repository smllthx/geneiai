import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import LanguagePicker from "./LanguagePicker";

const mocks = vi.hoisted(() => ({ upsert: vi.fn(), id: "account-a" as string | null }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.id ? { id: mocks.id } : null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { idioma: "es" } }) }) }), upsert: mocks.upsert }) } }));
function Labels() { const { t } = useLanguage(); return <h1>{t("Archivo familiar")}</h1>; }
const show = () => render(<LanguageProvider><LanguagePicker /><Labels /></LanguageProvider>);
beforeEach(() => { localStorage.clear(); mocks.upsert.mockReset().mockResolvedValue({ error: null }); mocks.id = "account-a"; });
afterEach(cleanup);
it("previews and cancels without writing, then saves only the account language", async () => {
  show();
  fireEvent.click(screen.getByRole("button", { name: "Idioma Español" }));
  fireEvent.click(screen.getByRole("radio", { name: /Italiano/ }));
  expect(screen.getByRole("heading", { level: 1, hidden: true })).toHaveTextContent("Archivo familiar");
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(mocks.upsert).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Idioma Español" }));
  fireEvent.click(screen.getByRole("radio", { name: /Italiano/ }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  await screen.findByRole("heading", { name: "Archivio familiare" });
  expect(mocks.upsert).toHaveBeenCalledWith({ user_id: "account-a", idioma: "it" }, { onConflict: "user_id" });
  expect(localStorage.getItem("geneai:language:account-a")).toBe("it");
});
it("keeps the active language when the cloud rejects the save", async () => {
  mocks.upsert.mockResolvedValue({ error: new Error("offline") }); show();
  fireEvent.click(screen.getByRole("button", { name: "Idioma Español" }));
  fireEvent.click(screen.getByRole("radio", { name: /English/ }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  await screen.findByRole("alert");
  expect(localStorage.getItem("geneai:language:account-a")).not.toBe("en");
  expect(screen.getByRole("heading", { level: 1, hidden: true })).toHaveTextContent("Archivo familiar");
});
