// Service Worker para Archivo Familiar — instalable + push + notificaciones.
// Mínimo y seguro: NO cachea HTML (evita pantallas viejas).
const CACHE = "archivo-v1";
const ASSETS = ["/app-icon-512.png", "/favicon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Estrategia: network-first; fallback a cache solo para iconos/manifest.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate") return; // dejar al navegador (siempre red)
  if (ASSETS.some((a) => url.pathname.endsWith(a))) {
    event.respondWith(
      fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return r; })
        .catch(() => caches.match(req))
    );
  }
});

// Web Push
self.addEventListener("push", (event) => {
  let payload = { title: "Archivo Familiar", body: "Nueva actividad", url: "/" };
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
    for (const c of all) {
      if ("focus" in c) { try { await c.navigate(url); } catch {} return c.focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
