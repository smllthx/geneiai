import { NavLink } from "react-router-dom";
import { GitBranch, Users, Sparkles, FileText, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/arbol", label: "Árbol", icon: GitBranch },
  { to: "/personas", label: "Personas", icon: Users },
  { to: "/investigacion-externa", label: "Investigar", icon: Sparkles },
  { to: "/documentos", label: "Fuentes", icon: FileText },
  { to: "/dashboard", label: "Más", icon: MoreHorizontal },
];

export default function MobileBottomNav() {
  return (
    <nav
      className="glass-strong fixed inset-x-0 bottom-0 z-30 mx-2 mb-2 flex justify-around rounded-2xl px-2 py-1.5 md:hidden"
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
