import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { Home, GitBranch, Users, Image as ImageIcon, Sparkles, Calendar, FileText, Heart, Bot, Compass, Dna, BookOpen, Settings, KeyRound, Upload, Lightbulb, Scan } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMobileItems } from "@/lib/navConfig";

const ALL = {
  "/inicio": { label: "Inicio", icon: Home },
  "/arbol": { label: "Árbol", icon: GitBranch },
  "/personas": { label: "Personas", icon: Users },
  "/familias": { label: "Familias", icon: Heart },
  "/fotos": { label: "Fotos", icon: ImageIcon },
  "/documentos": { label: "Documentos", icon: FileText },
  "/calendario": { label: "Calendario", icon: Calendar },
  "/investigacion": { label: "Investigar", icon: Sparkles },
  "/asistente": { label: "Asistente", icon: Bot },
  "/insights": { label: "Insights", icon: Lightbulb },
  "/coincidencias": { label: "Coincidir", icon: Compass },
  "/adn": { label: "ADN", icon: Dna },
  "/parecidos": { label: "Parecidos", icon: Scan },
  "/fuentes": { label: "Fuentes", icon: BookOpen },
  "/importar": { label: "Importar", icon: Upload },
  "/credenciales": { label: "Credenciales", icon: KeyRound },
  "/configuracion": { label: "Ajustes", icon: Settings },
} as const;

export default function MobileBottomNav() {
  const [paths, setPaths] = useState<string[]>(() => getMobileItems());
  useEffect(() => {
    const refresh = () => setPaths(getMobileItems());
    window.addEventListener("genaia:nav-config", refresh);
    return () => window.removeEventListener("genaia:nav-config", refresh);
  }, []);

  const items = paths.map((p) => ({ to: p, ...(ALL as any)[p] })).filter((i) => i.label);

  return (
    <nav
      className="glass-strong fixed inset-x-2 bottom-2 z-30 flex justify-around rounded-[1.75rem] px-2 py-1.5 ring-1 ring-border/40 md:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.375rem)" }}
    >
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-colors",
              isActive ? "text-primary" : "text-foreground/60",
            )
          }
        >
          <Icon className="h-5 w-5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export const MOBILE_NAV_OPTIONS = ALL;
