// Vite rethrows failed module and stylesheet preloads from the dynamic import.
export function isModuleLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /importing a module script failed|failed to fetch dynamically imported module|error loading dynamically imported module|unable to preload css for|loading (?:css )?chunk [\w-]+ failed/i.test(message);
}

export function hasOpenEditor() {
  return !!document.body && (document.body.dataset.geneiaiEditing === "1" ||
    !!document.querySelector("[data-geneiai-editing='true'], form, textarea, input:not([type=hidden]), [contenteditable=true], [role=dialog], iframe"));
}

function entryScript(doc: Document) {
  const path = doc.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute("src");
  if (!path) return null;
  const url = new URL(path, window.location.origin);
  return url.origin === window.location.origin && url.pathname.startsWith("/assets/") ? url.href : null;
}

/** Only a rendered, failed view may replace its document, and only after verifying a newer entry. */
export async function recoverStaleView(signal: AbortSignal, reload = () => window.location.reload()) {
  const installed = entryScript(document);
  const safe = () => !signal.aborted && navigator.onLine && document.visibilityState === "visible" && !hasOpenEditor();
  if (!installed || !safe()) return;

  try {
    const response = await fetch("/", { cache: "no-store", credentials: "omit", redirect: "error", signal });
    if (!response.ok || !response.headers.get("Content-Type")?.includes("text/html")) return;
    const published = entryScript(new DOMParser().parseFromString(await response.text(), "text/html"));
    if (!published || published === installed || !safe()) return;
    const guard = "geneai:module-recovery-at";
    const now = Date.now();
    if (now - Number(sessionStorage.getItem(guard)) < 120_000) return;
    // If tab storage is blocked we leave retry to the user rather than risk a loop.
    sessionStorage.setItem(guard, String(now));
    reload();
  } catch { /* Offline, aborted, or storage denied. The retry control remains available. */ }
}
