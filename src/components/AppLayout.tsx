import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Home, GitBranch, Users, Heart, FileText, Image as ImageIcon, Sparkles, Lightbulb as LightbulbIcon,
  Compass, Dna, BookOpen, Settings, LogOut, Upload, Bot, ChevronDown, KeyRound, Scan, Menu, Lightbulb, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SiriAssistant from "@/components/SiriAssistant";
import BackgroundJobs from "@/components/BackgroundJobs";
import MobileBottomNav from "@/components/MobileBottomNav";
import BrandLogo from "@/components/BrandLogo";
import NotificationBell from "@/components/NotificationBell";
import AdaptiveViewport from "@/components/AdaptiveViewport";
import ProbandPrompt from "@/components/ProbandPrompt";
import KeyboardAwareScroller from "@/components/KeyboardAwareScroller";

const primaryNav = [
  { to: "/inicio", label: "Inicio", icon: Home },
  { to: "/sugerencias", label: "Sugerencias", icon: LightbulbIcon },
  { to: "/arbol", label: "Árbol familiar", icon: GitBranch },
  { to: "/personas", label: "Personas", icon: Users },
  { to: "/familias", label: "Familias", icon: Heart },
  { to: "/documentos", label: "Documentos", icon: FileText },
  { to: "/fotos", label: "Fotos", icon: ImageIcon },
];
const investigationNav = [
  { to: "/asistente", label: "Asistente IA", icon: Bot },
  { to: "/busqueda-ia", label: "Búsqueda IA", icon: Sparkles },
  { to: "/insights", label: "Insights IA", icon: Lightbulb },
  { to: "/investigacion", label: "Investigación", icon: Sparkles },
  { to: "/coincidencias", label: "Coincidencias", icon: Compass },
  { to: "/adn", label: "ADN / Origen", icon: Dna },
  { to: "/parecidos", label: "Rasgos & parecidos", icon: Scan },
  { to: "/fuentes", label: "Fuentes", icon: BookOpen },
];
const utilityNav = [
  { to: "/importar", label: "Importar / Exportar", icon: Upload },
  { to: "/investigacion?tab=paralelo", label: "Agentes en paralelo", icon: Bot },
  { to: "/credenciales", label: "Credenciales", icon: KeyRound },
  { to: "/configuracion", label: "Configuración", icon: Settings },
];

function NavItems({ items }: { items: typeof primaryNav }) {
  return (
    <div className="space-y-1">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] transition-all",
              isActive
                ? "bg-primary/12 font-semibold text-foreground"
                : "text-foreground/75 hover:bg-foreground/5 hover:text-foreground",
            )
          }
        >
          <Icon className="h-5 w-5 shrink-0" /> <span className="truncate">{label}</span>
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
  const allMobileNav = [...primaryNav, ...investigationNav, ...utilityNav];

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("genaia:sidebar-collapsed") === "1";
  });
  useEffect(() => {
    localStorage.setItem("genaia:sidebar-collapsed", sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  // Notificaciones de aniversarios/cumpleaños: 1 vez al día por usuario
  useEffect(() => {
    if (!user) return;
    const k = `genaia:aniv:${user.id}:${new Date().toISOString().slice(0, 10)}`;
    if (localStorage.getItem(k)) return;
    localStorage.setItem(k, "1");
    supabase.functions.invoke("notificar-aniversarios").catch(() => {});
  }, [user?.id]);


  return (
    <div className="relative flex min-h-screen">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 p-3 transition-[width,opacity,transform] duration-300 ease-out md:flex md:flex-col",
          sidebarCollapsed ? "w-0 -translate-x-4 overflow-hidden p-0 opacity-0 pointer-events-none" : "w-64 opacity-100",
        )}
        aria-hidden={sidebarCollapsed}
      >
        <div className="glass-strong flex h-full flex-col rounded-3xl">
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-3">
              <BrandLogo size={52} />
              <div className="min-w-0">
                <h1 className="font-display text-xl font-semibold leading-none tracking-tight">GENAIA</h1>
                <p className="mt-1 text-[11px] text-muted-foreground">Sanguineti · Aeschlimann</p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <NotificationBell />
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
                  aria-label="Ocultar menú"
                  title="Ocultar menú"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </div>
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

      {/* Floating re-open arrow when sidebar is collapsed (desktop only) */}
      <button
        onClick={() => setSidebarCollapsed(false)}
        aria-label="Mostrar menú"
        title="Mostrar menú GENAIA"
        className={cn(
          "fixed left-0 top-1/2 z-40 hidden -translate-y-1/2 items-center justify-center rounded-r-2xl border border-l-0 border-border bg-card/90 px-1.5 py-3 text-foreground/70 shadow-md backdrop-blur-md transition-all duration-300 hover:bg-card hover:text-foreground hover:px-2 md:flex",
          sidebarCollapsed ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 pointer-events-none",
        )}
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className="glass-strong fixed inset-x-2 z-40 flex items-center justify-between rounded-2xl px-3 py-2 md:hidden"
          style={{
            top: "calc(env(safe-area-inset-top, 0px) + 0.5rem)",
          }}
        >
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl" aria-label="Abrir menú">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[86vw] max-w-sm overflow-y-auto p-3"
              style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
            >
              <SheetTitle className="sr-only">Menú principal de GENAIA</SheetTitle>
              <div className="mb-4 flex items-center gap-3 pr-8">
                <BrandLogo size={44} />
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold leading-none">GENAIA</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <NavItems items={allMobileNav} />
              <Button variant="ghost" size="sm" className="mt-4 w-full justify-start gap-2 rounded-xl" onClick={handleLogout}>
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </Button>
            </SheetContent>
          </Sheet>
          <NavLink to="/inicio" className="flex items-center gap-2">
            <BrandLogo size={34} />
            <span className="font-display text-lg font-semibold">GENAIA</span>
          </NavLink>
          <NotificationBell />
        </div>
        <main
          className="min-w-0 flex-1 pb-28 md:px-8 md:pt-6 md:pb-8"
          style={{
            paddingLeft: "max(env(safe-area-inset-left, 0px), 1rem)",
            paddingRight: "max(env(safe-area-inset-right, 0px), 1rem)",
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 4.5rem)",
          }}
        >
          <Outlet />
        </main>
      </div>

      <SiriAssistant />
      <BackgroundJobs />
      <MobileBottomNav />
      <AdaptiveViewport />
      <ProbandPrompt />
      <KeyboardAwareScroller />
    </div>
  );
}
