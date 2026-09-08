import { routeLoaderFor } from "@/lib/routeLoaders";

const prefetched = new Set<string>();
type Connection = { saveData?: boolean; effectiveType?: string };

export function prefetchRoute(path: string) {
  if (typeof window === "undefined") return;
  const connection = (navigator as Navigator & { connection?: Connection }).connection;
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? "")) return;
  const route = path.split(/[?#]/)[0].replace(/\/$/, "") || "/inicio";
  const load = routeLoaderFor(route);
  if (!load || prefetched.has(route)) return;
  prefetched.add(route);
  const preload = () => { load().catch(() => prefetched.delete(route)); };
  if (window.requestIdleCallback) window.requestIdleCallback(preload, { timeout: 500 });
  else window.setTimeout(preload, 80);
}
