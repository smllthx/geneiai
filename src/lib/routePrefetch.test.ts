import { afterEach, beforeEach, expect, it, vi } from "vitest";
const loader = vi.hoisted(() => vi.fn());
vi.mock("@/lib/routeLoaders", () => ({ routeLoaderFor: (route: string) => route === "/personas" ? loader : undefined }));
beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); loader.mockReset().mockResolvedValue({}); });
afterEach(() => { vi.useRealTimers(); Object.defineProperty(navigator, "connection", { configurable: true, value: undefined }); });
it("preloads the route module once, without requesting HTML", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  const { prefetchRoute } = await import("./routePrefetch");
  prefetchRoute("/personas?sort=name"); prefetchRoute("/personas");
  await vi.runAllTimersAsync();
  expect(loader).toHaveBeenCalledTimes(1);
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});
it("respects data saver and retries a failed preload", async () => {
  const { prefetchRoute } = await import("./routePrefetch");
  Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } });
  prefetchRoute("/personas"); await vi.runAllTimersAsync();
  expect(loader).not.toHaveBeenCalled();
  Object.defineProperty(navigator, "connection", { configurable: true, value: {} });
  loader.mockRejectedValueOnce(new Error("offline"));
  prefetchRoute("/personas"); await vi.runAllTimersAsync();
  prefetchRoute("/personas"); await vi.runAllTimersAsync();
  expect(loader).toHaveBeenCalledTimes(2);
});
