// Only public application files are cached. Account data always uses the network.
// Vite replaces the revision so every release is detected by installed apps.
const VERSION = "geneai-pwa-v5-__GENEAI_BUILD_ID__";
const APP_SHELL_CACHE = `${VERSION}-shell`;
// Fingerprinted assets remain usable by windows still running the previous release.
const ASSET_CACHE = "geneai-pwa-v5-assets";
const APP_SHELL = ["/offline.html", "/favicon.png", "/logo-sidebar.png", "/apple-touch-icon.png", "/app-icon-192.png", "/app-icon-512.png"];

async function cacheAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type !== "opaque" && !response.headers.get("Content-Type")?.includes("text/html")) {
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - 160)).map((key) => cache.delete(key)));
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  // Updates wait for the existing app's Actualizar action, preserving open forms.
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("geneai-pwa-") && key !== APP_SHELL_CACHE && key !== ASSET_CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || request.headers.has("Authorization")) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/mcp" || url.pathname.startsWith("/.well-known/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(APP_SHELL_CACHE);
      return (await cache.match("/offline.html")) || new Response("GENEAI: conéctate a internet para continuar.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }));
    return;
  }
  if (url.pathname.startsWith("/assets/") && /\.(?:js|css|woff2?|png|jpe?g|webp|svg)$/.test(url.pathname)) {
    event.respondWith(cacheAsset(request));
    return;
  }
  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(caches.open(APP_SHELL_CACHE).then(async (cache) => (await cache.match(request)) || fetch(request)));
  }
});
self.addEventListener("push", (event) => {
  let payload = { title: "GENEAI", body: "Nueva actividad", url: "/" };
  try { if (event.data) payload = { ...payload, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body, icon: "/app-icon-512.png", badge: "/app-icon-512.png", data: { url: payload.url },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of all) {
      if ("focus" in client) {
        try { await client.navigate(url.href); } catch {}
        return client.focus();
      }
    }
    return self.clients.openWindow?.(url.href);
  })());
});
