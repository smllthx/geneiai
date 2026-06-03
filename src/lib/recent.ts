// Recientes: personas visitadas/editadas (localStorage, máx 12).
const KEY = "genaia.recent.personas";
const MAX = 12;

export type RecentEntry = { id: string; ts: number; action?: "viewed" | "edited" };

export function getRecent(): RecentEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}

export function pushRecent(id: string, action: RecentEntry["action"] = "viewed") {
  if (!id) return;
  const cur = getRecent().filter((e) => e.id !== id);
  cur.unshift({ id, ts: Date.now(), action });
  localStorage.setItem(KEY, JSON.stringify(cur.slice(0, MAX)));
  window.dispatchEvent(new Event("genaia:recent-changed"));
}

export function clearRecent() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("genaia:recent-changed"));
}
