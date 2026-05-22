// Persiste el orden personalizado de las opciones del menú lateral por grupo
const KEY = (group: string) => `genaia:nav-order:${group}`;

export function loadOrder<T extends { to: string }>(group: string, items: T[]): T[] {
  try {
    const raw = localStorage.getItem(KEY(group));
    if (!raw) return items;
    const order: string[] = JSON.parse(raw);
    const map = new Map(items.map(i => [i.to, i]));
    const ordered: T[] = [];
    order.forEach(k => { const v = map.get(k); if (v) { ordered.push(v); map.delete(k); } });
    return [...ordered, ...map.values()];
  } catch { return items; }
}

export function saveOrder(group: string, items: { to: string }[]) {
  try { localStorage.setItem(KEY(group), JSON.stringify(items.map(i => i.to))); } catch {}
}
