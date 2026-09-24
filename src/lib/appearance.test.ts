import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getAppearance, setAppearance, startAppearance } from "./appearance";

let dispose: (() => void) | undefined;
beforeEach(() => { localStorage.clear(); document.documentElement.className = ""; });
afterEach(() => { dispose?.(); vi.restoreAllMocks(); });
function system(dark: boolean) {
  const media = new EventTarget() as EventTarget & { matches: boolean };
  media.matches = dark;
  vi.spyOn(window, "matchMedia").mockReturnValue(media as unknown as MediaQueryList);
  return media;
}
it("follows live system changes, including the legacy forced-dark installation", () => {
  localStorage.setItem("genai:theme", "dark");
  const media = system(false);
  dispose = startAppearance();
  expect(getAppearance()).toBe("system");
  expect(document.documentElement).not.toHaveClass("dark");
  media.matches = true; media.dispatchEvent(new Event("change"));
  expect(document.documentElement).toHaveClass("dark");
  media.matches = false; media.dispatchEvent(new Event("change"));
  expect(document.documentElement).not.toHaveClass("dark");
});
it("keeps an explicit preference until System is selected again", () => {
  const media = system(true);
  dispose = startAppearance();
  setAppearance("light");
  media.dispatchEvent(new Event("change"));
  expect(document.documentElement).not.toHaveClass("dark");
  expect(getAppearance()).toBe("light");
  setAppearance("system");
  expect(document.documentElement).toHaveClass("dark");
});
it("aligns browser chrome with the resolved theme", () => {
  const meta = document.createElement("meta"); meta.name = "theme-color"; document.head.append(meta);
  system(true); dispose = startAppearance();
  expect(meta.content).toBe("#111723");
  setAppearance("light");
  expect(meta.content).toBe("#f3f5fb");
  expect(document.documentElement.style.colorScheme).toBe("light");
  meta.remove();
});
