import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Home, GitBranch, Users, Heart, FileText, Image as ImageIcon, Sparkles,
  Compass, Dna, BookOpen, Settings, LogOut, Upload, Bot, ChevronDown, KeyRound, Scan,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SiriAssistant from "@/components/SiriAssistant";
import MobileBottomNav from "@/components/MobileBottomNav";
import BrandLogo from "@/components/BrandLogo";
import NotificationBell from "@/components/NotificationBell";

const primaryNav = [
  { to: "/inicio", label: "Inicio", icon: Home },
  { to: "/arbol", label: "Árbol familiar", icon: GitBranch },
  { to: "/personas", label: "Personas", icon: Users },
  { to: "/familias", label: "Familias", icon: Heart },
  { to: "/documentos", label: "Documentos", icon: FileText },
  { to: "/fotos", label: "Fotos", icon: ImageIcon },
];
const investigationNav = [
  { to: "/asistente", label: "Asistente IA", icon: Bot },
  { to: "/investigacion", label: "Investigación", icon: Sparkles },
  { to: "/coincidencias", label: "Coincidencias", icon: Compass },
  { to: "/adn", label: "ADN / Origen", icon: Dna },
  { to: "/parecidos", label: "Rasgos & parecidos", icon: Scan },
  { to: "/fuentes", label: "Fuentes", icon: BookOpen },
];
const utilityNav = [
  { to: "/importar", label: "Importar / Exportar", icon: Upload },
  { to: "/agente", label: "Agente IA", icon: Bot },
  { to: "/credenciales", label: "Credenciales", icon: KeyRound },
  { to: "/configuracion", label: "Configuración", icon: Settings },
];

function NavItems({ items }: { items: typeof primaryNav }) {
  return (
    <div className="space-y-0.5">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all",
              isActive
                ? "bg-primary/12 font-medium text-foreground"
                : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground",
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0" /> <span className="truncate">{label}</span>
        </NavLink>
      ))}
    </div>
  );
}

function NavGroup({ label, items }: { label: string; items: typeof primaryNav }) {
  const { pathname } = useLocation();
  const containsActive = items.some((i) => pathname.startsWith(i.to));
  const [open, setOpen] = useState(containsActive);
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <span>{label}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="mt-1"><NavItems items={items} /></div>}
    </div>
  );
}

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => { await signOut(); navigate("/login"); };

  return (
    <div className="relative flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 p-3 md:flex md:flex-col">
        <div className="glass-strong flex h-full flex-col rounded-3xl">
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2.5">
              <BrandLogo size={30} />
              <h1 className="font-display text-lg font-semibold tracking-tight">Archivo</h1>
              <div className="ml-auto"><NotificationBell /></div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Sanguineti · Aeschlimann</p>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 pb-2">
            <NavItems items={primaryNav} />
            <NavGroup label="Investigación" items={investigationNav} />
            <NavGroup label="Herramientas" items={utilityNav} />
          </nav>
          <div className="m-2 rounded-2xl bg-foreground/5 p-3">
            <p className="mb-2 truncate text-xs text-muted-foreground">{user?.email}</p>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 rounded-xl" onClick={handleLogout}>
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-30 md:hidden"
          style={{
            height: "env(safe-area-inset-top, 0px)",
            background: "hsl(var(--background) / 0.85)",
            backdropFilter: "saturate(180%) blur(20px)",
            WebkitBackdropFilter: "saturate(180%) blur(20px)",
          }}
        />
        <main
          className="min-w-0 flex-1 px-4 py-6 pb-28 md:px-8 md:py-8 md:pb-8"
          style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 1rem)" }}
        >
          <Outlet />
        </main>
      </div>

      <SiriAssistant />
      <MobileBottomNav />
    </div>
  );
}
