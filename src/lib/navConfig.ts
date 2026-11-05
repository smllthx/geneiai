import { navigationGroups } from "./navigation";

// Configuración persistente de menús (sidebar y barra inferior móvil).
// Incluye presets y lista de elementos ocultos por grupo. Emite un evento
// `genaia:nav-config` cuando cambia para que las navs se refresquen en vivo.

export type NavPreset = "basico" | "avanzado" | "pro" | "personalizado";

const PRESET_KEY = "genaia:nav-preset";
const NAV_VERSION_KEY = "genaia:nav-version";
const HIDDEN_KEY = (group: string) => `genaia:nav-hidden:${group}`;
const MOBILE_KEY = "genaia:nav-mobile"; // array de paths para la barra inferior

export const DEFAULT_MOBILE: string[] = ["/inicio", "/arbol", "/personas", "/investigacion", "/configuracion"];

// Qué se oculta en cada preset (paths). El preset "pro" no oculta nada.
const PRESET_HIDDEN: Record<NavPreset, Record<string, string[]>> = {
  basico: { archive: ["/lugares", "/linea-de-tiempo"], utility: ["/fusionar", "/credenciales", "/configurar-app"] },
  avanzado: { utility: ["/credenciales", "/configurar-app"] },
  pro: {},
  personalizado: {},
};

function migrateNavDefaults() {
  try {
    if (localStorage.getItem(NAV_VERSION_KEY) === "geneai-family-menu-v2") return;
    const preset = (localStorage.getItem(PRESET_KEY) || "avanzado") as NavPreset;
    if (preset !== "personalizado") {
      for (const group of navigationGroups) {
        localStorage.setItem(HIDDEN_KEY(group.key), JSON.stringify(PRESET_HIDDEN[preset]?.[group.key] ?? []));
      }
    } else {
      const hidden = new Set(["primary", "archive", "investigation", "utility"].flatMap(key =>
        JSON.parse(localStorage.getItem(HIDDEN_KEY(key)) || "[]") as string[]
      ));
      for (const group of navigationGroups) {
        localStorage.setItem(HIDDEN_KEY(group.key), JSON.stringify(group.items.map(item => item.to).filter(path => hidden.has(path))));
      }
    }
    localStorage.setItem(NAV_VERSION_KEY, "geneai-family-menu-v2");
  } catch {}
}

export function getPreset(): NavPreset {
  migrateNavDefaults();
  try { return (localStorage.getItem(PRESET_KEY) as NavPreset) || "avanzado"; } catch { return "avanzado"; }
}

export function setPreset(p: NavPreset) {
  try {
    localStorage.setItem(PRESET_KEY, p);
    if (p !== "personalizado") {
      const map = PRESET_HIDDEN[p];
      navigationGroups.forEach(group => {
        localStorage.setItem(HIDDEN_KEY(group.key), JSON.stringify(map[group.key] ?? []));
      });
    }
    window.dispatchEvent(new CustomEvent("genaia:nav-config"));
  } catch {}
}

export function getHidden(group: string): string[] {
  migrateNavDefaults();
  try {
    const raw = localStorage.getItem(HIDDEN_KEY(group));
    if (raw) return JSON.parse(raw);
  } catch {}
  return PRESET_HIDDEN[getPreset()]?.[group] ?? [];
}

export function setHidden(group: string, hidden: string[]) {
  try {
    localStorage.setItem(HIDDEN_KEY(group), JSON.stringify(hidden));
    localStorage.setItem(PRESET_KEY, "personalizado");
    window.dispatchEvent(new CustomEvent("genaia:nav-config"));
  } catch {}
}

export function toggleHidden(group: string, path: string) {
  group = group.replace(/^mobile-/, "");
  const cur = new Set(getHidden(group));
  if (cur.has(path)) cur.delete(path); else cur.add(path);
  setHidden(group, [...cur]);
}

export function filterByHidden<T extends { to: string }>(group: string, items: T[]): T[] {
  const hidden = new Set(getHidden(group.replace(/^mobile-/, "")));
  return items.filter((i) => !hidden.has(i.to));
}

export function getMobileItems(): string[] {
  migrateNavDefaults();
  try {
    const raw = localStorage.getItem(MOBILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_MOBILE;
}

export function setMobileItems(paths: string[]) {
  try {
    localStorage.setItem(MOBILE_KEY, JSON.stringify(paths.slice(0, 5)));
    window.dispatchEvent(new CustomEvent("genaia:nav-config"));
  } catch {}
}
