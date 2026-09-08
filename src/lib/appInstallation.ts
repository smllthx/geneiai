interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallationState = { installed: boolean; canPrompt: boolean };
const listeners = new Set<() => void>();
const initialState: InstallationState = { installed: false, canPrompt: false };
let state = initialState;
let deferredPrompt: InstallPromptEvent | null = null;
let started = false;

function update(next: InstallationState) {
  if (state.installed === next.installed && state.canPrompt === next.canPrompt) return;
  state = next;
  listeners.forEach((listener) => listener());
}

// Capture the browser event before the lazy-loaded settings screen is opened.
export function startAppInstallation() {
  if (started || typeof window === "undefined") return;
  started = true;
  const display = window.matchMedia("(display-mode: standalone), (display-mode: window-controls-overlay)");
  const checkDisplay = () => update({
    installed: display.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    canPrompt: deferredPrompt !== null,
  });
  checkDisplay();
  display.addEventListener("change", checkDisplay);
  window.addEventListener("pageshow", checkDisplay);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    checkDisplay();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    update({ installed: true, canPrompt: false });
  });
}

export const subscribeInstallation = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const getInstallationSnapshot = () => state;
export const getInstallationServerSnapshot = () => initialState;

export async function promptAppInstallation() {
  const prompt = deferredPrompt;
  if (!prompt || state.installed) return "unavailable";
  deferredPrompt = null;
  update({ ...state, canPrompt: false });
  // Must be called directly from a user gesture, before any other awaited work.
  await prompt.prompt();
  return (await prompt.userChoice).outcome;
}

// Platform is used only for installation instructions; layout follows viewport size.
export function getInstallationPlatform() {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Mac/i.test(ua)) return "macos";
  return "desktop";
}
