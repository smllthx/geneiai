import config from "../../config/geneai-backend.json";

const prefix = "storage://fotos/";
export function photoStoragePath(reference?: string | null) {
  if (!reference) return null;
  if (reference.startsWith(prefix)) return reference.slice(prefix.length);
  try {
    const url = new URL(reference);
    if (url.origin !== config.supabaseUrl) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/fotos\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch { return null; }
}

const lifetime = 3600;
type Signed = { url: string; expires: number };
type Sign = (paths: string[], expiresIn: number) => Promise<{ data: { path: string | null; signedUrl: string | null; error: string | null }[] | null; error: unknown }>;

export function createPhotoAccess(userId: string, sign: Sign) {
  const cache = new Map<string, Signed>();
  const pending = new Map<string, Promise<Signed | null>>();
  const batch = new Map<string, (value: Signed | null) => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function flush() {
    timer = undefined;
    const entries = [...batch];
    batch.clear();
    for (let start = 0; start < entries.length; start += 100) {
      const chunk = entries.slice(start, start + 100);
      const results = new Map<string, Signed>();
      try {
        const { data, error } = await sign(chunk.map(([path]) => path), lifetime);
        if (!error) for (const item of data ?? []) {
          if (item.path && item.signedUrl && !item.error) results.set(item.path, { url: item.signedUrl, expires: Date.now() + (lifetime - 120) * 1000 });
        }
      } catch { /* Offline or no permission to read this object. */ } finally {
        for (const [path, resolve] of chunk) {
          const result = results.get(path) ?? null;
          pending.delete(path);
          if (result) cache.set(path, result);
          resolve(result);
        }
      }
    }
  }
  return (path: string) => {
    const parts = path.split("/");
    if (parts.length < 2 || parts[0] !== userId || path.length > 1024 || /[\\\x00]/.test(path) || parts.some(p => !p || p === "." || p === "..")) return Promise.resolve(null);
    const hit = cache.get(path);
    if (hit && hit.expires > Date.now()) return Promise.resolve(hit);
    const running = pending.get(path);
    if (running) return running;
    const promise = new Promise<Signed | null>(resolve => batch.set(path, resolve));
    pending.set(path, promise);
    if (timer === undefined) timer = setTimeout(() => { void flush(); }, 0);
    return promise;
  };
}
