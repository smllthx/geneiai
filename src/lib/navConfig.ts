// Configuración persistente de menús (sidebar y barra inferior móvil).
// Incluye presets y lista de elementos ocultos por grupo. Emite un evento
// `genaia:nav-config` cuando cambia para que las navs se refresquen en vivo.

export type NavPreset = "basico" | "avanzado" | "pro" | "personalizado";

const PRESET_KEY = "genaia:nav-preset";
const NAV_VERSION_KEY = "genaia:nav-version";
const HIDDEN_KEY = (group: string) => `genaia:nav-hidden:${group}`;
const MOBILE_KEY = "genaia:nav-mobile"; // array de paths para la barra inferior

export const DEFAULT_MOBILE: string[] = ["/inicio", "/arbol", "/personas", "/apellidos", "/asistente"];

// Qué se oculta en cada preset (paths). El preset "pro" no oculta nada.
const PRESET_HIDDEN: Record<NavPreset, Record<string, string[]>> = {
  basico: {
    primary: ["/calendario", "/familias"],
    investigation: ["/coincidencias", "/adn", "/parecidos", "/fuentes", "/busqueda-ia", "/insights"],
    utility: ["/credenciales", "/fusionar", "/investigacion?tab=paralelo"],
    mobile: [],
  },
  avanzado: {
    primary: [],
    investigation: ["/busqueda-ia", "/insights"],
    utility: ["/investigacion?tab=paralelo"],
    mobile: [],
  },
  pro: {
    primary: [],
    investigation: ["/busqueda-ia", "/insights"],
    utility: ["/investigacion?tab=paralelo"],
    mobile: [],
  },
  personalizado: { primary: [], investigation: [], utility: [], mobile: [] },
};

function migrateNavDefaults() {
  try {
    if (localStorage.getItem(NAV_VERSION_KEY) === "minimal-apellidos-2026-05-27") return;
    localStorage.setItem(PRESET_KEY, "avanzado");
    Object.entries(PRESET_HIDDEN.avanzado).forEach(([group, hidden]) => {
      localStorage.setItem(HIDDEN_KEY(group), JSON.stringify(hidden));
    });
    localStorage.setItem(MOBILE_KEY, JSON.stringify(DEFAULT_MOBILE));
    localStorage.setItem(NAV_VERSION_KEY, "minimal-apellidos-2026-05-27");
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
      Object.entries(map).forEach(([group, hidden]) => {
        localStorage.setItem(HIDDEN_KEY(group), JSON.stringify(hidden));
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
  const cur = new Set(getHidden(group));
  if (cur.has(path)) cur.delete(path); else cur.add(path);
  setHidden(group, [...cur]);
}

export function filterByHidden<T extends { to: string }>(group: string, items: T[]): T[] {
  const hidden = new Set(getHidden(group));
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
