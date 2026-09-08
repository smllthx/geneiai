import { afterEach, expect, it, vi } from "vitest";
import { applyAppUpdate } from "./pwa";

afterEach(() => { delete document.body.dataset.geneiaiEditing; vi.unstubAllGlobals(); });

it("does not activate an update while a person is being edited", async () => {
  const postMessage = vi.fn();
  const getRegistration = vi.fn().mockResolvedValue({ waiting: { postMessage } });
  vi.stubGlobal("navigator", { serviceWorker: { getRegistration } });
  document.body.dataset.geneiaiEditing = "1";
  expect(await applyAppUpdate()).toBe("editing");
  expect(getRegistration).not.toHaveBeenCalled();
  expect(postMessage).not.toHaveBeenCalled();
  delete document.body.dataset.geneiaiEditing;
  expect(await applyAppUpdate()).toBe("requested");
  expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
});

it("rechecks editing after awaiting the worker registration", async () => {
  const postMessage = vi.fn();
  vi.stubGlobal("navigator", { serviceWorker: { getRegistration: async () => {
    document.body.dataset.geneiaiEditing = "1";
    return { waiting: { postMessage } };
  } } });
  expect(await applyAppUpdate()).toBe("editing");
  expect(postMessage).not.toHaveBeenCalled();
});
