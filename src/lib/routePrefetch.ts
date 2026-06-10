const prefetched = new Set<string>();

export function prefetchRoute(path: string) {
  if (typeof window === "undefined") return;
  if (!path || prefetched.has(path)) return;
  prefetched.add(path);
  window.requestIdleCallback?.(() => {
    fetch(path, { method: "GET", cache: "force-cache" }).catch(() => undefined);
  }) ?? window.setTimeout(() => {
    fetch(path, { method: "GET", cache: "force-cache" }).catch(() => undefined);
  }, 80);
}
