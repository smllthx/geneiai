import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, type MouseEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Home, GitBranch, Users, Heart, FileText, Image as ImageIcon, Sparkles, Lightbulb as LightbulbIcon,
  Compass, Dna, BookOpen, Settings, LogOut, Upload, Bot, ChevronDown, KeyRound, Scan, Menu, Lightbulb, ChevronLeft, ChevronRight, Merge, Calendar, GripVertical, ListOrdered, Link2, RefreshCw, ClipboardCheck,
  PanelRightOpen, ArrowLeft, EyeOff, Settings2, MousePointerClick,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SiriAssistant from "@/components/SiriAssistant";
import BackgroundJobs from "@/components/BackgroundJobs";
import MobileBottomNav from "@/components/MobileBottomNav";
import BrandLogo from "@/components/BrandLogo";
import NotificationBell from "@/components/NotificationBell";
import AdaptiveViewport from "@/components/AdaptiveViewport";
import KeyboardAwareScroller from "@/components/KeyboardAwareScroller";
import AppUpdateNotifier from "@/components/AppUpdateNotifier";
import GlobalDataSync from "@/components/GlobalDataSync";
import OriginBackgroundSync from "@/components/OriginBackgroundSync";
import NetworkStatusModal from "@/components/NetworkStatusModal";
import OfflineContextKeeper from "@/components/OfflineContextKeeper";
import AppWindowLayer from "@/components/AppWindowLayer";
import UniversalPersonSearch from "@/components/UniversalPersonSearch";
import { loadOrder, saveOrder } from "@/lib/navOrder";
import { filterByHidden, toggleHidden } from "@/lib/navConfig";
import { prefetchRoute } from "@/lib/routePrefetch";
import { toast } from "sonner";


const primaryNavBase = [
  { to: "/inicio", label: "Inicio", icon: Home },
  { to: "/arbol", label: "Árbol", icon: GitBranch },
  { to: "/personas", label: "Personas", icon: Users },
  { to: "/apellidos", label: "Apellidos", icon: ListOrdered },
  { to: "/familias", label: "Familias", icon: Heart },
  { to: "/fotos", label: "Recuerdos", icon: ImageIcon },
  { to: "/documentos", label: "Documentos", icon: FileText },
  { to: "/calendario", label: "Calendario", icon: Calendar },
];
const investigationNav = [
  { to: "/asistente", label: "Genealogista IA", icon: Bot },
  { to: "/investigacion", label: "Investigación", icon: Sparkles },
  { to: "/importadas-pendientes", label: "Importadas pendientes", icon: Link2 },
  { to: "/sugerencias", label: "Tareas y pistas", icon: LightbulbIcon },
  { to: "/tareas-ia", label: "Tareas IA", icon: ClipboardCheck },
  { to: "/adn", label: "ADN y origen", icon: Dna },
  { to: "/cuadros-ia", label: "Cuadros IA", icon: ImageIcon },
  { to: "/fuentes", label: "Fuentes", icon: BookOpen },
  { to: "/coincidencias", label: "Coincidencias", icon: Compass },
  { to: "/parecidos", label: "Rasgos y parecidos", icon: Scan },
];
const utilityNav = [
  { to: "/importar", label: "Importar / Exportar", icon: Upload },
  { to: "/fusionar", label: "Fusionar duplicados", icon: Merge },
  { to: "/credenciales", label: "Credenciales", icon: KeyRound },
  { to: "/configuracion", label: "Configuración", icon: Settings },
];

type NavItem = { to: string; label: string; icon: any };

function NavItems({ groupKey, items }: { groupKey: string; items: NavItem[] }) {
  const navigate = useNavigate();
  const [ordered, setOrdered] = useState<NavItem[]>(() => loadOrder(groupKey, filterByHidden(groupKey, items)));
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [options, setOptions] = useState<{ item: NavItem; x: number; y: number } | null>(null);

  useEffect(() => {
    const refresh = () => setOrdered(loadOrder(groupKey, filterByHidden(groupKey, items)));
    refresh();
    window.addEventListener("genaia:nav-config", refresh);
    return () => window.removeEventListener("genaia:nav-config", refresh);
  }, [groupKey, items.length]);


  const onDrop = (toIdx: number) => {
    if (dragIdx === null || dragIdx === toIdx) return;
    const next = [...ordered];
    const [m] = next.splice(dragIdx, 1);
    next.splice(toIdx, 0, m);
    setOrdered(next);
    saveOrder(groupKey, next);
    setDragIdx(null);
  };

  const openWindow = (item: NavItem) => {
    window.dispatchEvent(
      new CustomEvent("geneai:open-window", {
        detail: { id: item.to, title: item.label, path: item.to },
      }),
    );
  };

  const openOptions = (item: NavItem, event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setOptions({
      item,
      x: Math.min(rect.right + 8, window.innerWidth - 288),
      y: Math.min(rect.top, window.innerHeight - 245),
    });
  };

  const openMenuSettings = () => {
    window.dispatchEvent(
      new CustomEvent("geneai:open-window", {
        detail: { id: "/configuracion#menus", title: "Menús de la app", path: "/configuracion" },
      }),
    );
  };

  return (
    <div className="space-y-1">
      {ordered.map((item, idx) => {
        const { to, label, icon: Icon } = item;
        return (
        <div
          key={to}
          draggable
          onDragStart={() => setDragIdx(idx)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(idx)}
          className="group/row relative"
        >
          <div className="flex items-center gap-1">
            <NavLink
              to={to}
              onDoubleClick={(event) => openOptions(item, event)}
              onMouseEnter={() => prefetchRoute(to)}
              onFocus={() => prefetchRoute(to)}
              title="Doble clic para opciones de esta función"
              className={({ isActive }) =>
                cn(
                  "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] transition-all",
                  isActive
                    ? "bg-primary/12 font-semibold text-foreground"
                    : "text-foreground/75 hover:bg-foreground/5 hover:text-foreground",
                )
              }
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/40 opacity-0 transition group-hover/row:opacity-100" />
              <Icon className="h-5 w-5 shrink-0" /> <span className="truncate">{label}</span>
            </NavLink>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openWindow(item);
              }}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground opacity-100 transition hover:bg-foreground/8 hover:text-primary md:opacity-0 md:group-hover/row:opacity-100"
              title={`Abrir ${label} en ventana`}
              aria-label={`Abrir ${label} en una ventana dentro de la app`}
            >
              <PanelRightOpen className="h-4 w-4" />
            </button>
          </div>
        </div>
        );
      })}
      {options && (
        <div className="fixed inset-0 z-[95]" onClick={() => setOptions(null)}>
          <div
            className="glass-strong fixed w-72 rounded-2xl border border-white/20 p-2 shadow-2xl"
            style={{ left: options.x, top: options.y }}
            onClick={(event) => event.stopPropagation()}
            role="menu"
            aria-label={`Opciones de ${options.item.label}`}
          >
            <div className="px-3 py-2">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Opciones rápidas</p>
              <p className="truncate text-sm font-semibold">{options.item.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">Doble clic abre este panel nativo.</p>
            </div>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-foreground/8"
              onClick={() => {
                navigate(options.item.to);
                setOptions(null);
              }}
            >
              <MousePointerClick className="h-4 w-4 text-primary" /> Abrir aquí
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-foreground/8"
              onClick={() => {
                openWindow(options.item);
                setOptions(null);
              }}
            >
              <PanelRightOpen className="h-4 w-4 text-primary" /> Abrir en ventana
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-foreground/8"
              onClick={() => {
                toggleHidden(groupKey, options.item.to);
                toast.success(`${options.item.label} se ocultó del menú`);
                setOptions(null);
              }}
            >
              <EyeOff className="h-4 w-4 text-muted-foreground" /> Ocultar del menú
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-foreground/8"
              onClick={() => {
                openMenuSettings();
                setOptions(null);
              }}
            >
              <Settings2 className="h-4 w-4 text-primary" /> Configurar todos los menús
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavGroup({ groupKey, label, items }: { groupKey: string; label: string; items: NavItem[] }) {
  const { pathname } = useLocation();
  const containsActive = items.some((i) => pathname.startsWith(i.to));
  const [open, setOpen] = useState(containsActive);
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        onDoubleClick={(event) => {
          event.preventDefault();
          window.dispatchEvent(
            new CustomEvent("geneai:open-window", {
              detail: { id: `/configuracion#${groupKey}`, title: `Configurar ${label}`, path: "/configuracion" },
            }),
          );
        }}
        title="Doble clic para configurar esta sección"
        className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <span>{label}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="mt-1"><NavItems groupKey={groupKey} items={items} /></div>}
    </div>
  );
}

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isWindowFrame = new URLSearchParams(location.search).get("window") === "1";
  const handleLogout = async () => { await signOut(); navigate("/login"); };
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/inicio");
  };
  const refreshVisibleData = () => {
    window.dispatchEvent(new CustomEvent("genaia:data-changed", { detail: { source: "manual" } }));
    window.dispatchEvent(new Event("genaia:recent-changed"));
    toast.success("Datos actualizados");
  };
  const allMobileNav = [...primaryNavBase, ...investigationNav, ...utilityNav];

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("genaia:sidebar-collapsed") === "1";
  });
  useEffect(() => {
    localStorage.setItem("genaia:sidebar-collapsed", sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  useEffect(() => {
    const shortcuts: Record<string, string> = {
      "1": "/inicio",
      "2": "/arbol",
      "3": "/personas",
      "4": "/sugerencias",
      "5": "/asistente",
      "n": "/personas/nueva",
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      if (!event.metaKey && !event.ctrlKey) return;
      const route = shortcuts[event.key.toLowerCase()];
      if (!route) return;
      event.preventDefault();
      navigate(route);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  // Notificaciones de aniversarios/cumpleaños: 1 vez al día por usuario
  useEffect(() => {
    if (!user) return;
    const k = `genaia:aniv:${user.id}:${new Date().toISOString().slice(0, 10)}`;
    if (localStorage.getItem(k)) return;
    localStorage.setItem(k, "1");
    supabase.functions.invoke("notificar-aniversarios").catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    const onAiError = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail?.message) return;
      toast.error(detail.message, {
        description: detail.functionName ? `Opción IA: ${detail.functionName}` : undefined,
        duration: 7000,
      });
    };
    window.addEventListener("genaia:ia-error", onAiError);
    return () => window.removeEventListener("genaia:ia-error", onAiError);
  }, []);


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
              <BrandLogo size={68} showText subtitle="Archivo familiar privado" />
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
          <div className="px-3 pb-3">
            <UniversalPersonSearch />
          </div>
          <nav className="flex-1 overflow-y-auto px-2 pb-2">
            <NavItems groupKey="primary" items={primaryNavBase} />
            <NavGroup groupKey="investigation" label="Investigación" items={investigationNav} />
            <NavGroup groupKey="utility" label="Herramientas" items={utilityNav} />
          </nav>
          <div className="m-2 rounded-2xl bg-foreground/5 p-3">
            <p className="mb-2 truncate text-xs text-muted-foreground">{user?.email}</p>
            <Button variant="ghost" size="sm" className="mb-1 w-full justify-start gap-2 rounded-xl" onClick={refreshVisibleData}>
              <RefreshCw className="h-4 w-4" /> Actualizar datos
            </Button>
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
        title="Mostrar menú GENEAI"
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
            top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
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
              <SheetTitle className="sr-only">Menú principal de GENEAI</SheetTitle>
              <div className="mb-4 flex items-center gap-3 pr-8">
                <BrandLogo size={58} showText subtitle={user?.email ?? "Archivo familiar privado"} />
              </div>
              <NavItems groupKey="mobile" items={allMobileNav} />
              <Button variant="ghost" size="sm" className="mt-4 w-full justify-start gap-2 rounded-xl" onClick={refreshVisibleData}>
                <RefreshCw className="h-4 w-4" /> Actualizar datos
              </Button>
              <Button variant="ghost" size="sm" className="mt-4 w-full justify-start gap-2 rounded-xl" onClick={handleLogout}>
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </Button>
            </SheetContent>
          </Sheet>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={goBack} aria-label="Volver atrás">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <NavLink to="/inicio" className="flex items-center gap-2">
            <BrandLogo size={42} showText />
          </NavLink>
          <div className="flex items-center gap-1">
            <UniversalPersonSearch compact />
            <NotificationBell />
          </div>
        </div>
        <main
          className="min-w-0 flex-1 pb-28 md:px-8 md:pt-6 md:pb-8"
          style={{
            paddingLeft: "max(env(safe-area-inset-left, 0px), 1rem)",
            paddingRight: "max(env(safe-area-inset-right, 0px), 1rem)",
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)",
          }}
        >
          <div className="mb-4 hidden items-center gap-2 md:flex">
            <Button variant="ghost" size="sm" className="rounded-xl" onClick={goBack}>
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
            <UniversalPersonSearch className="max-w-52" />
          </div>
          <Outlet />
        </main>
      </div>

      <SiriAssistant />
      <BackgroundJobs />
      <MobileBottomNav />
      <AdaptiveViewport />
      <AppUpdateNotifier />
      <NetworkStatusModal />
      <OfflineContextKeeper />
      <GlobalDataSync />
      <OriginBackgroundSync />
      <KeyboardAwareScroller />
      {!isWindowFrame && <AppWindowLayer />}
    </div>
  );
}
