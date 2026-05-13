import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, GitBranch, FileText, Search, Globe, Sparkles,
  Compass, Lightbulb, Brain, MapPin, Clock, Settings, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { to: "/personas", label: "Personas", icon: Users },
  { to: "/arbol", label: "Árbol familiar", icon: GitBranch },
  { to: "/documentos", label: "Documentos", icon: FileText },
  { to: "/buscar", label: "Buscar", icon: Search },
  { to: "/investigacion-externa", label: "Investigación externa", icon: Globe },
  { to: "/coincidencias", label: "Coincidencias", icon: Sparkles },
  { to: "/pistas", label: "Pistas", icon: Compass },
  { to: "/hipotesis", label: "Hipótesis", icon: Lightbulb },
  { to: "/inferencias", label: "Inferencias", icon: Brain },
  { to: "/lugares", label: "Lugares", icon: MapPin },
  { to: "/linea-de-tiempo", label: "Línea de tiempo", icon: Clock },
  { to: "/configuracion", label: "Configuración", icon: Settings },
];

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => { await signOut(); navigate("/login"); };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <div className="border-b border-sidebar-border px-5 py-5">
          <h1 className="font-serif text-xl leading-tight text-sidebar-foreground">Archivo Familiar</h1>
          <p className="text-xs italic text-muted-foreground">Sanguineti · Aeschlimann</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )
              }
            >
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <p className="mb-2 truncate text-xs text-muted-foreground">{user?.email}</p>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-3 md:hidden">
          <h1 className="font-serif text-lg">Archivo Familiar</h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="h-4 w-4" /></Button>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
