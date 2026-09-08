let started = false;
let reloadForUpdate = false;
export const isAppEditing = () => document.body.dataset.geneiaiEditing === "1" || Boolean(document.querySelector("[data-geneiai-editing='true']"));

export function registerSW() {
  if (started || typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  // Embedded windows share this origin; never unregister the main app's worker.
  try { if (window.self !== window.top) return; } catch { return; }
  started = true;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloadForUpdate) return;
    reloadForUpdate = false;
    if (isAppEditing()) return;
    window.location.reload();
  });
  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      const notifyReady = () => {
        if (registration.waiting) window.dispatchEvent(new CustomEvent("genaia:update-ready"));
      };
      notifyReady();
      registration.addEventListener("updatefound", () => {
        const next = registration.installing;
        next?.addEventListener("statechange", () => {
          if (next.state === "installed" && navigator.serviceWorker.controller) notifyReady();
        });
      });
      let lastCheck = Date.now();
      const checkUpdate = () => {
        if (document.visibilityState !== "visible" || !navigator.onLine || Date.now() - lastCheck < 60_000) return;
        lastCheck = Date.now();
        void registration.update().catch(() => undefined);
        notifyReady();
      };
      document.addEventListener("visibilitychange", checkUpdate);
      window.addEventListener("online", checkUpdate);
      window.addEventListener("pageshow", checkUpdate);
    } catch { /* Browsers without worker access can still use the online app. */ }
  };
  if (document.readyState === "complete") void register();
  else window.addEventListener("load", () => { void register(); }, { once: true });
}

export async function applyAppUpdate() {
  if (isAppEditing()) return "editing";
  if (!("serviceWorker" in navigator)) return "unavailable";
  const registration = await navigator.serviceWorker.getRegistration();
  if (registration && !registration.waiting) await registration.update();
  if (isAppEditing()) return "editing";
  if (registration?.waiting) {
    reloadForUpdate = true;
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    return "requested";
  }
  return "unavailable";
}

export async function clearAppCache() {
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("geneai-pwa-")).map((name) => caches.delete(name)));
    }
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update().catch(() => undefined);
    }
    localStorage.setItem("genaia:last-cache-clear", new Date().toISOString());
    return true;
  } catch { return false; }
}
