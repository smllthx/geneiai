import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useIsMobile } from "./use-mobile";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("uses the compact viewport on the first render and updates when the breakpoint changes", () => {
  const media = new EventTarget() as EventTarget & { matches: boolean };
  media.matches = true;
  const match = vi.spyOn(window, "matchMedia").mockReturnValue(media as unknown as MediaQueryList);
  const { result } = renderHook(useIsMobile);
  expect(result.current).toBe(true);
  expect(match).toHaveBeenCalledWith(expect.stringContaining("(pointer: coarse) and (max-height: 500px)"));
  act(() => { media.matches = false; media.dispatchEvent(new Event("change")); });
  expect(result.current).toBe(false);
});
