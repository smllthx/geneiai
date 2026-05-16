// Aplica la "reparación" en caliente según la acción sugerida por la IA y recarga.
export type HealAction = "reload" | "clear-cache" | "clear-storage" | "reset-sw" | "relogin" | "none";

export async function applyHeal(action: HealAction) {
  try {
    if (action === "reset-sw" || action === "clear-cache") {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    }
    if (action === "clear-storage") {
      // Conserva el tema y la sesión de auth — limpia el resto.
      const keep = new Map<string, string | null>();
      const preserve = ["genai:theme", "genai:density", "genai:viewport"];
      preserve.forEach((k) => keep.set(k, localStorage.getItem(k)));
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}
      preserve.forEach((k) => { const v = keep.get(k); if (v != null) localStorage.setItem(k, v); });
    }
    if (action === "relogin") {
      try { localStorage.removeItem("sb-vkzofofafjvbazvrhhyj-auth-token"); } catch {}
    }
  } catch (e) {
    console.warn("applyHeal error", e);
  } finally {
    // Forzar recarga limpia
    setTimeout(() => { window.location.replace(window.location.pathname); }, 250);
  }
}
