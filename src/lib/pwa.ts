// Registro del service worker con guardas para iframes.
export function registerSW() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();

  if (inIframe) {
    // En iframes: desregistrar cualquier SW para evitar pantallas cacheadas.
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
