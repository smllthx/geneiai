export type Appearance = "system" | "light" | "dark";

// The old genai:theme key was written even when no preference was chosen.
// Start the redesigned appearance in System mode; only explicit choices persist.
const KEY = "genai:appearance-v1";
const EVENT = "geneai:appearance";
export function getAppearance(): Appearance {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch { return "system"; }
}
export function subscribeAppearance(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
export function setAppearance(value: Appearance) {
  try { localStorage.setItem(KEY, value); } catch { /* Session still works without storage. */ }
  applyAppearance(value);
  window.dispatchEvent(new Event(EVENT));
}
export function applyAppearance(value = getAppearance()) {
  const dark = value === "dark" || (value === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  root.dataset.appearance = value;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#111723" : "#f3f5fb");
}
export function startAppearance() {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const update = () => applyAppearance();
  update();
  media.addEventListener("change", update);
  const unsubscribe = subscribeAppearance(update);
  return () => { media.removeEventListener("change", update); unsubscribe(); };
}
