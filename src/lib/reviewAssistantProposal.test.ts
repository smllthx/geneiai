import { beforeEach, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { requestBiographyProposal } from "./biographyProposal";
import { applyAssistantProposal } from "./reviewAssistantProposal";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), functions: { invoke: vi.fn() } } }));
const from = vi.mocked(supabase.from);
beforeEach(() => { vi.resetAllMocks(); });

it("uses the deployed biography response as a pending proposal", async () => {
  vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { ok: true, bio: "Borrador", review_required: true, applied: false, sugerencia_id: "draft" }, error: null });
  expect(await requestBiographyProposal("subject")).toBe("draft");
  expect(supabase.functions.invoke).toHaveBeenCalledWith("biografia-auto", { body: { person_id: "subject" } });
  expect(from).not.toHaveBeenCalled();
});

it("applies the proposed relationship direction to the checked tree, without inserting a person", async () => {
  const check = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: [{ id: "child" }, { id: "father" }] }) };
  const upsert = vi.fn().mockResolvedValue({ error: null });
  from.mockReturnValueOnce(check as never).mockReturnValueOnce({ upsert } as never);
  await applyAssistantProposal({ id: "draft", tipo: "nueva_relacion", payload: { source_id: "child", target_id: "father", tipo: "padre" } }, "user", "tree");
  expect(check.eq).toHaveBeenCalledWith("arbol_id", "tree");
  expect(from.mock.calls.map(call => call[0])).toEqual(["personas", "relaciones"]);
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user", arbol_id: "tree", persona_id: "child", pariente_id: "father", tipo: "padre" }), expect.anything());
});

it("refuses to overwrite biography notes edited after the proposal", async () => {
  const query = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null }) };
  from.mockReturnValueOnce(query as never);
  await expect(applyAssistantProposal({ id: "draft", tipo: "actualizar_persona", persona_id: "subject", payload: {
    notas: "Propuesta", expected_current_notes: "Anterior", generated_biography: "Texto",
  } }, "user", "tree")).rejects.toThrow(/cambió/);
  expect(query.eq).toHaveBeenCalledWith("notas", "Anterior");
  expect(query.update).toHaveBeenCalledWith({ notas: "Propuesta" });
});

it("never converts an unrecognized suggestion into a person", async () => {
  await expect(applyAssistantProposal({ id: "draft", tipo: "hipotesis", payload: {} }, "user", "tree")).rejects.toThrow(/revisión manual/);
  expect(from).not.toHaveBeenCalled();
});
