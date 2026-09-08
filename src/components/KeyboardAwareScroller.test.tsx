import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import KeyboardAwareScroller from "./KeyboardAwareScroller";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("batches viewport changes, marks keyboard state and cleans up listeners", () => {
  const viewport = Object.assign(new EventTarget(), { height: 350, width: 390, offsetTop: 0, offsetLeft: 0, scale: 1 });
  Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  const queue: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", vi.fn((cb: FrameRequestCallback) => { queue.push(cb); return queue.length; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const view = render(<><KeyboardAwareScroller /><input aria-label="Nom" /></>);
  const input = view.getByLabelText("Nom");
  input.scrollIntoView = vi.fn();
  input.focus();
  act(() => {
    viewport.dispatchEvent(new Event("resize"));
    viewport.dispatchEvent(new Event("resize"));
    viewport.dispatchEvent(new Event("scroll"));
  });
  expect(queue).toHaveLength(1);
  act(() => { queue.shift()?.(0); });
  expect(document.documentElement.style.getPropertyValue("--visual-viewport-height")).toBe("350px");
  expect(document.documentElement.dataset.keyboardOpen).toBe("true");
  expect(input.scrollIntoView).toHaveBeenCalledTimes(1);
  act(() => { viewport.dispatchEvent(new Event("scroll")); queue.shift()?.(0); });
  expect(input.scrollIntoView).toHaveBeenCalledTimes(1);
  view.unmount();
  viewport.dispatchEvent(new Event("resize"));
  expect(queue).toHaveLength(0);
  expect(document.documentElement.dataset.keyboardOpen).toBeUndefined();
  Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
});
