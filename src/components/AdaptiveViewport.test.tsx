import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AdaptiveViewport from "./AdaptiveViewport";
const screenSize = vi.hoisted(() => ({ width: 320, height: 568 }));
vi.mock("@/hooks/use-device", () => ({ useDevice: () => ({ ...screenSize, kind: "phone", platform: "iphone", orientation: screenSize.width > screenSize.height ? "landscape" : "portrait", touch: true, coarsePointer: true }) }));
beforeEach(() => { localStorage.clear(); screenSize.width = 320; screenSize.height = 568; });
afterEach(cleanup);
it("keeps automatic text at 100% on small phones, keyboard resize, and rotation", () => {
  const view = render(<AdaptiveViewport />);
  expect(document.documentElement.style.fontSize).toBe("100%");
  screenSize.height = 250;
  view.rerender(<AdaptiveViewport />);
  expect(document.documentElement.style.fontSize).toBe("100%");
  screenSize.width = 844; screenSize.height = 390;
  view.rerender(<AdaptiveViewport />);
  expect(document.documentElement.style.fontSize).toBe("100%");
});
it("preserves a user's explicit manual scale", () => {
  localStorage.setItem("genai:ui-auto", "0");
  localStorage.setItem("genai:ui-scale", "1.2");
  render(<AdaptiveViewport />);
  expect(document.documentElement.style.fontSize).toBe("120%");
});
