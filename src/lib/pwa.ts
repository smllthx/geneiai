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
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      registration.addEventListener("updatefound", () => {
        const next = registration.installing;
        if (!next) return;
        next.addEventListener("statechange", () => {
          if (next.state === "installed" && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent("genaia:update-ready", { detail: registration }));
          }
        });
      });
    }).catch(() => {});
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

export function applyAppUpdate() {
  navigator.serviceWorker.getRegistration().then((registration) => {
    registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
  });
}
