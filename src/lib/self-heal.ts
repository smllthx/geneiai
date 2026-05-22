// Aplica la "reparación" en caliente según la acción sugerida por la IA y recarga.
export type HealAction =
  | "reload"
  | "clear-cache"
  | "clear-storage"
  | "reset-sw"
  | "relogin"
  | "deep-repair"
  | "none";

async function clearServiceWorkers() {
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }
}

async function clearCachesAPI() {
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}

async function clearIndexedDB() {
  try {
    // @ts-ignore — databases() no está en todos los tipos
    if (indexedDB?.databases) {
      // @ts-ignore
      const dbs: { name?: string }[] = await indexedDB.databases();
      await Promise.all(
        dbs
          .filter((d) => d?.name)
          .map(
            (d) =>
              new Promise<void>((res) => {
                const req = indexedDB.deleteDatabase(d.name as string);
                req.onsuccess = req.onerror = req.onblocked = () => res();
              })
          )
      );
    }
  } catch (e) {
    console.warn("clearIndexedDB error", e);
  }
}

function clearStorage(preserveAuth = true) {
  const keep = new Map<string, string | null>();
  const preserve = ["genai:theme", "genai:density", "genai:viewport"];
  if (preserveAuth) {
    // Preservar token de Supabase para no cerrar sesión
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) preserve.push(k);
    }
  }
  preserve.forEach((k) => keep.set(k, localStorage.getItem(k)));
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  preserve.forEach((k) => { const v = keep.get(k); if (v != null) localStorage.setItem(k, v); });
}

export async function applyHeal(action: HealAction) {
  try {
    if (action === "reset-sw" || action === "clear-cache") {
      await clearServiceWorkers();
      await clearCachesAPI();
    }
    if (action === "clear-storage") {
      clearStorage(true);
    }
    if (action === "relogin") {
      try { localStorage.removeItem("sb-vkzofofafjvbazvrhhyj-auth-token"); } catch {}
    }
    if (action === "deep-repair") {
      // Reparación total: SW + caches + storage + IndexedDB. Mantiene sesión.
      await clearServiceWorkers();
      await clearCachesAPI();
      await clearIndexedDB();
      clearStorage(true);
    }
  } catch (e) {
    console.warn("applyHeal error", e);
  } finally {
    // Forzar recarga limpia, sin caché del navegador
    setTimeout(() => {
      const url = window.location.pathname + "?_r=" + Date.now();
      window.location.replace(url);
    }, 300);
  }
}

