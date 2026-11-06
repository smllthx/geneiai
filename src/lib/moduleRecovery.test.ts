import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { isModuleLoadError, recoverStaleView } from "./moduleRecovery";

const shell = (build: string) => `<script type="module" src="/assets/index-${build}.js"></script>`;
const response = (build: string) => new Response(shell(build), { headers: { "Content-Type": "text/html" } });
const check = (reload = vi.fn()) => recoverStaleView(new AbortController().signal, reload);
beforeEach(() => {
  document.head.innerHTML = shell("old");
  sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => response("new")));
});
afterEach(() => {
  document.head.innerHTML = ""; document.body.innerHTML = "";
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it.each(["Importing a module script failed.", "Failed to fetch dynamically imported module: /assets/page.js",
  "error loading dynamically imported module", "Unable to preload CSS for /assets/file.css"])("recognises %s", message => {
  expect(isModuleLoadError(new TypeError(message))).toBe(true);
  expect(isModuleLoadError(new TypeError("Cannot read properties of undefined"))).toBe(false);
});

it("reloads once only when the published entry differs", async () => {
  const reload = vi.fn();
  vi.mocked(fetch).mockResolvedValueOnce(response("old"));
  await check(reload); expect(reload).not.toHaveBeenCalled();
  await check(reload); await check(reload);
  expect(reload).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith("/", expect.objectContaining({ cache: "no-store", credentials: "omit" }));
});

it("never reloads on a failed probe, cancellation or restricted storage", async () => {
  const reload = vi.fn();
  vi.mocked(fetch).mockRejectedValueOnce(new Error("network")); await check(reload);
  vi.mocked(fetch).mockResolvedValueOnce(new Response("offline", { status: 503 })); await check(reload);
  const controller = new AbortController(); controller.abort(); await recoverStaleView(controller.signal, reload);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); }); await check(reload);
  expect(reload).not.toHaveBeenCalled();
});

it("protects an existing editor, including one opened while checking for a deployment", async () => {
  const reload = vi.fn();
  document.body.innerHTML = '<main data-geneiai-editing="true"></main>';
  await check(reload); expect(fetch).not.toHaveBeenCalled();
  document.body.innerHTML = "";
  vi.mocked(fetch).mockImplementationOnce(async () => { document.body.innerHTML = "<textarea></textarea>"; return response("new"); });
  await check(reload); expect(reload).not.toHaveBeenCalled();
});

it("does not probe offline or from an inactive tab", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  await check();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  await check(); expect(fetch).not.toHaveBeenCalled();
});
