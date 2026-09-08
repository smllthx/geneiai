import { NavLink } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Home, GitBranch, Users, Image as ImageIcon, Sparkles, Calendar, FileText, Heart, Bot, Compass, Dna, BookOpen, Settings, KeyRound, Upload, Lightbulb, Scan, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMobileItems } from "@/lib/navConfig";

const ALL = {
  "/inicio": { label: "Inicio", icon: Home },
  "/arbol": { label: "Árbol", icon: GitBranch },
  "/personas": { label: "Personas", icon: Users },
  "/apellidos": { label: "Apellidos", icon: ListOrdered },
  "/familias": { label: "Familia", icon: Heart },
  "/sugerencias": { label: "Tareas", icon: Lightbulb },
  "/fotos": { label: "Recuerdos", icon: ImageIcon },
  "/documentos": { label: "Docs", icon: FileText },
  "/calendario": { label: "Fechas", icon: Calendar },
  "/investigacion": { label: "Investigar", icon: Sparkles },
  "/asistente": { label: "ChatGPT", icon: Bot },
  "/origen-ancestral": { label: "ADN", icon: Dna },
  "/cuadros-ia": { label: "Cuadros", icon: ImageIcon },
  "/insights": { label: "Insights", icon: Lightbulb },
  "/coincidencias": { label: "Coincidir", icon: Compass },
  "/adn": { label: "Origen", icon: Dna },
  "/parecidos": { label: "Parecidos", icon: Scan },
  "/fuentes": { label: "Fuentes", icon: BookOpen },
  "/importar": { label: "Importar", icon: Upload },
  "/credenciales": { label: "Credenciales", icon: KeyRound },
  "/configuracion": { label: "Ajustes", icon: Settings },
} as const;

export default function MobileBottomNav() {
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
      className="mobile-bottom-nav glass-strong fixed z-30 grid rounded-2xl p-1.5 ring-1 ring-border/40"
      style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}
    >
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-1.5 text-xs font-medium transition-colors",
              isActive ? "text-primary" : "text-foreground/60",
            )
          }
        >
          <Icon className="h-5 w-5" />
          <span className="max-w-full break-words text-center leading-tight">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export const MOBILE_NAV_OPTIONS = ALL;
