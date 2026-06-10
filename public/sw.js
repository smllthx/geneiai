// GENEAI service worker: app shell, offline fallback, push and smart runtime cache.
// Keep this file dependency-free so it works in Vite/Vercel without a build plugin.
const VERSION = "geneai-pwa-v4";
const APP_SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const IMAGE_CACHE = `${VERSION}-images`;
const API_CACHE = `${VERSION}-api`;

const APP_SHELL = [
  "/",
  "/login",
  "/inicio",
  "/offline.html",
  "/favicon.png",
  "/logo-sidebar.png",
  "/apple-touch-icon.png",
  "/app-icon-192.png",
  "/app-icon-512.png",
  "/manifest.webmanifest",
];

const MAX_IMAGE_ENTRIES = 90;
const MAX_API_ENTRIES = 80;
const API_TTL_MS = 5 * 60 * 1000;

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

function timestampedResponse(response) {
  const headers = new Headers(response.headers);
  headers.set("sw-cached-at", String(Date.now()));
  return response.blob().then((body) => new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  }));
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || (await network) || Response.error();
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
    trimCache(cacheName, maxEntries);
  }
  return response;
}

async function apiNetworkFirst(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cached = await timestampedResponse(response.clone());
      await cache.put(request, cached);
      trimCache(API_CACHE, MAX_API_ENTRIES);
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (!cached) throw new Error("offline");
    const cachedAt = Number(cached.headers.get("sw-cached-at") || "0");
    if (cachedAt && Date.now() - cachedAt > API_TTL_MS) {
      return new Response(JSON.stringify({
        offline: true,
        stale: true,
        message: "Datos guardados sin conexión. Reintenta al volver internet.",
      }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
    return cached;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("geneai-pwa-") && !key.startsWith(VERSION))
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.pathname === "/api/health") {
    event.respondWith(new Response(JSON.stringify({ ok: true, service: "GENEAI" }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    }));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          return (await caches.match(request))
            || (await caches.match("/"))
            || (await caches.match("/offline.html"));
        }),
    );
    return;
  }

  if (url.origin === self.location.origin && /\.(?:js|css|woff2?|html)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
    return;
  }

  if (/\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_ENTRIES));
    return;
  }

  if (url.hostname.includes("supabase.co") && url.pathname.includes("/rest/v1/")) {
    event.respondWith(apiNetworkFirst(request));
  }
});

// Web Push
self.addEventListener("push", (event) => {
  let payload = { title: "GENEAI", body: "Nueva actividad", url: "/" };
  try { if (event.data) payload = { ...payload, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/app-icon-512.png",
    badge: "/app-icon-512.png",
    data: { url: payload.url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of all) {
      if ("focus" in client) {
        try { await client.navigate(url); } catch {}
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
