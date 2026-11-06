import { geneIcon } from "./GeneIcon";
import { useLanguage } from "@/contexts/LanguageContext";
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Home, GitBranch, Users, Image as ImageIcon, Sparkles, Calendar, FileText, Heart, Bot, Compass, Dna, BookOpen, Settings, KeyRound, Upload, Lightbulb, Scan, ListOrdered } from "@/components/icons";
import { cn } from "@/lib/utils";
import { prefetchRoute } from "@/lib/routePrefetch";
import { getMobileItems } from "@/lib/navConfig";

const ALL = {
  "/inicio": { label: "Inicio", icon: geneIcon("home") },
  "/arbol": { label: "Árbol", icon: geneIcon("tree") },
  "/personas": { label: "Personas", icon: geneIcon("people") },
  "/apellidos": { label: "Apellidos", icon: geneIcon("tag") },
  "/familias": { label: "Familia", icon: geneIcon("people") },
  "/sugerencias": { label: "Tareas", icon: geneIcon("bulb") },
  "/fotos": { label: "Fotos", icon: geneIcon("photos") },
  "/documentos": { label: "Docs", icon: geneIcon("document") },
  "/calendario": { label: "Fechas", icon: geneIcon("calendar") },
  "/investigacion": { label: "Investigación", icon: geneIcon("search") },
  "/asistente": { label: "ChatGPT", icon: geneIcon("spark") },
  "/origen-ancestral": { label: "ADN", icon: geneIcon("dna") },
  "/cuadros-ia": { label: "Cuadros", icon: geneIcon("photos") },
  "/insights": { label: "Insights", icon: geneIcon("bulb") },
  "/coincidencias": { label: "Coincidencias", icon: geneIcon("compass") },
  "/adn": { label: "ADN", icon: geneIcon("dna") },
  "/parecidos": { label: "Parecidos", icon: geneIcon("compare") },
  "/fuentes": { label: "Fuentes", icon: geneIcon("book") },
  "/importar": { label: "Importar", icon: geneIcon("upload") },
  "/credenciales": { label: "Credenciales", icon: geneIcon("user") },
  "/configuracion": { label: "Ajustes", icon: geneIcon("settings") },
} as const;

export default function MobileBottomNav() {
  const { t } = useLanguage();
  const previewHome = useLocation().pathname === "/diseno";
  const navRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const update = () => document.documentElement.style.setProperty("--bottom-nav-height", `${nav.getBoundingClientRect().height}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);
  const [paths, setPaths] = useState<string[]>(() => getMobileItems());
  useEffect(() => {
    const refresh = () => setPaths(getMobileItems());
    window.addEventListener("genaia:nav-config", refresh);
    return () => window.removeEventListener("genaia:nav-config", refresh);
  }, []);

  const items = paths.filter((p): p is keyof typeof ALL => p in ALL).slice(0, 5).map((p) => ({ to: p, ...ALL[p] }));

  return (
    <nav
      ref={navRef}
      aria-label="Navegación principal"
      className="mobile-bottom-nav glass-strong fixed z-30 grid rounded-full p-1.5"
      style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}
    >
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onPointerEnter={() => prefetchRoute(to)}
          onTouchStart={() => prefetchRoute(to)}
          onFocus={() => prefetchRoute(to)}
          className={({ isActive }) =>
            cn(
              "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-full px-0.5 py-1.5 text-xs font-medium transition-colors",
              (isActive || (previewHome && to === "/inicio")) ? "mobile-tab-active text-primary" : "text-foreground/60",
            )
          }
        >
          <Icon className="h-6 w-6" />
          <span className="max-w-full break-words text-center leading-tight">{t(label)}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export const MOBILE_NAV_OPTIONS = ALL;
