// Only public application files are cached. Account data always uses the network.
// Vite replaces the revision so every release is detected by installed apps.
const VERSION = "geneai-pwa-v5-__GENEAI_BUILD_ID__";
const DEPLOYMENT_ORIGIN = "__GENEAI_DEPLOYMENT_ORIGIN__";
const APP_SHELL_CACHE = `${VERSION}-shell`;
// Fingerprinted assets remain usable by windows still running the previous release.
const ASSET_CACHE = "geneai-pwa-v5-assets";
// Only the offline document and its artwork are needed on every install.
const APP_SHELL = ["/offline.html", "/app-icon-192.png"];

function isAsset(response, path) {
  if (!response || !response.ok || response.type === "opaque") return false;
  const type = response.headers.get("Content-Type") || "";
  if (path.endsWith(".js")) return /(?:java|ecma)script/i.test(type);
  if (path.endsWith(".css")) return /^text\/css\b/i.test(type);
  return !/^text\/html\b/i.test(type);
}

async function rememberAsset(cache, request, response) {
  await cache.put(request, response);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - 160)).map(key => cache.delete(key)));
}

async function cacheAsset(event, path) {
  const { request } = event;
  const cache = await caches.open(ASSET_CACHE).catch(() => null);
  const cached = cache && await cache.match(request).catch(() => null);
  if (isAsset(cached, path)) return cached;
  let response = await fetch(request);
  // A running tab may request a lazy module after the production alias has moved.
  if (DEPLOYMENT_ORIGIN.startsWith("https://") && DEPLOYMENT_ORIGIN !== self.location.origin &&
      /-[\w-]{8}\.(js|css)$/.test(path) && (response.status === 404 || (response.ok && !isAsset(response, path)))) {
    try {
      const pinned = await fetch(DEPLOYMENT_ORIGIN + path, { mode: "cors", credentials: "omit", redirect: "error" });
      if (isAsset(pinned, path)) {
        response = new Response(pinned.body, { headers: { "Content-Type": pinned.headers.get("Content-Type") } });
      }
    } catch { /* Let the app recover if this deployment is no longer available. */ }
  }
  if (cache && isAsset(response, path)) {
    event.waitUntil(rememberAsset(cache, request, response.clone()).catch(() => {}));
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
    event.respondWith(cacheAsset(event, url.pathname));
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
