import { NavLink } from "react-router-dom";
import { Home, GitBranch, Users, Image as ImageIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/inicio", label: "Inicio", icon: Home },
  { to: "/arbol", label: "Árbol", icon: GitBranch },
  { to: "/personas", label: "Personas", icon: Users },
  { to: "/fotos", label: "Fotos", icon: ImageIcon },
  { to: "/investigacion", label: "Investigar", icon: Sparkles },
];

export default function MobileBottomNav() {
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
