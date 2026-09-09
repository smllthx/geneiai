import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";


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

function NavItems({ groupKey, items, onNavigate }: { groupKey: string; items: NavItem[]; onNavigate?: () => void }) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [ordered, setOrdered] = useState<NavItem[]>(() => loadOrder(groupKey, filterByHidden(groupKey, items)));
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [options, setOptions] = useState<string | null>(null);

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
          draggable={!isMobile}
          onDragStart={() => setDragIdx(idx)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(idx)}
          className="group/row relative"
        >
          <div className="flex items-center gap-1">
            <NavLink
              to={to}
              onClick={onNavigate}
              onDoubleClick={(event) => { event.preventDefault(); setOptions(to); }}
              onMouseEnter={() => prefetchRoute(to)}
              onFocus={() => prefetchRoute(to)}
              title="Doble clic para opciones de esta función"
              className={({ isActive }) =>
                cn(
                  "flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-primary/12 font-semibold text-foreground"
                    : "text-foreground/75 hover:bg-foreground/5 hover:text-foreground",
                )
              }
            >
              {!isMobile && <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/40 opacity-0 transition group-hover/row:opacity-100" />}
              <Icon className="h-5 w-5 shrink-0" /> <span className="min-w-0 break-words">{label}</span>
            </NavLink>
            <DropdownMenu open={options === to} onOpenChange={(open) => setOptions(open ? to : null)}>
              <DropdownMenuTrigger asChild>
                <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-foreground/5" aria-label={`Opciones de ${label}`}>
                  <PanelRightOpen className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side={isMobile ? "bottom" : "right"} align="start" collisionPadding={12} className="nav-options w-72 rounded-2xl p-2">
                <DropdownMenuLabel className="whitespace-normal break-words">{label}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => { navigate(to); onNavigate?.(); }}>
                  <MousePointerClick className="mr-2 h-4 w-4 shrink-0" /> Abrir aquí
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { openWindow(item); onNavigate?.(); }}>
                  <PanelRightOpen className="mr-2 h-4 w-4 shrink-0" /> Abrir en ventana
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { toggleHidden(groupKey, to); toast.success(`${label} se ocultó del menú`); }}>
                  <EyeOff className="mr-2 h-4 w-4 shrink-0" /> Ocultar del menú
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { openMenuSettings(); onNavigate?.(); }}>
                  <Settings2 className="mr-2 h-4 w-4 shrink-0" /> Configurar menús
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        );
      })}

    </div>
  );
}

function NavGroup({ groupKey, label, items, onNavigate }: { groupKey: string; label: string; items: NavItem[]; onNavigate?: () => void }) {
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
        className="flex w-full items-center justify-between min-h-11 rounded-lg px-3 py-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <span>{label}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="mt-1"><NavItems groupKey={groupKey} items={items} onNavigate={onNavigate} /></div>}
    </div>
  );
}

export default function AppLayout() {
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname, location.search, isMobile]);
  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const update = () => document.documentElement.style.setProperty("--app-header-height", `${header.getBoundingClientRect().height}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, [isMobile]);
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
    <div className="app-shell relative flex min-h-screen" data-navigation={isMobile ? "compact" : "wide"}>
      {!isMobile && !isWindowFrame && !sidebarCollapsed && <aside
        className={cn(
          "app-sidebar sticky top-0 flex h-dvh min-h-0 shrink-0 flex-col p-3",
          sidebarCollapsed ? "w-0 -translate-x-4 overflow-hidden p-0 opacity-0 pointer-events-none" : "w-72 opacity-100",
        )}
        aria-hidden={sidebarCollapsed}
      >
        <div className="glass-strong flex h-full flex-col rounded-3xl">
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-3">
              <BrandLogo className="min-w-0 flex-1" size={44} showText subtitle="Archivo familiar privado" />
              <div className="ml-auto flex items-center gap-1">
                {!sidebarCollapsed && <NotificationBell />}
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
                  aria-label="Ocultar menú"
                  title="Ocultar menú"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
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
      </aside>}

      {/* Floating re-open arrow when sidebar is collapsed (desktop only) */}
      {!isMobile && !isWindowFrame && <button
        onClick={() => setSidebarCollapsed(false)}
        aria-label="Mostrar menú"
        title="Mostrar menú GENEAI"
        className={cn(
          "fixed left-0 top-1/2 z-40 hidden -translate-y-1/2 items-center justify-center rounded-r-2xl border border-l-0 border-border bg-card/90 px-1.5 py-3 text-foreground/70 shadow-md backdrop-blur-md transition-all duration-300 hover:bg-card hover:text-foreground hover:px-2 md:flex",
          sidebarCollapsed ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 pointer-events-none",
        )}
      >
        <ChevronRight className="h-5 w-5" />
      </button>}

      <div className="flex min-w-0 flex-1 flex-col">
        {isMobile && !isWindowFrame && <div ref={headerRef} className="mobile-app-header glass-strong fixed z-40 flex items-center justify-between gap-1 rounded-2xl p-2">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-xl" aria-label="Abrir menú">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="mobile-menu-sheet overflow-y-auto overscroll-contain p-3"
              aria-describedby={undefined}
            >
              <SheetTitle className="sr-only">Menú principal de GENEAI</SheetTitle>
              <div className="mb-4 flex items-center gap-3 pr-8">
                <BrandLogo size={58} showText subtitle={user?.email ?? "Archivo familiar privado"} />
              </div>
              <div className="mobile-nav-groups">
                <NavItems groupKey="mobile-primary" items={primaryNavBase} onNavigate={() => setMobileMenuOpen(false)} />
                <NavGroup groupKey="mobile-investigation" label="Investigación y pistas" items={investigationNav} onNavigate={() => setMobileMenuOpen(false)} />
                <NavGroup groupKey="mobile-utility" label="Herramientas y cuenta" items={utilityNav} onNavigate={() => setMobileMenuOpen(false)} />
              </div>
              <Button variant="ghost" size="sm" className="mt-4 w-full justify-start gap-2 rounded-xl" onClick={refreshVisibleData}>
                <RefreshCw className="h-4 w-4" /> Actualizar datos
              </Button>
              <Button variant="ghost" size="sm" className="mt-4 w-full justify-start gap-2 rounded-xl" onClick={handleLogout}>
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </Button>
            </SheetContent>
          </Sheet>
          <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-xl" onClick={goBack} aria-label="Volver atrás">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <NavLink to="/inicio" aria-label="GENEAI, inicio" className="mobile-brand min-w-0 flex-1">
            <BrandLogo className="min-w-0" size={36} showText />
          </NavLink>
          <div className="flex items-center gap-1">
            <UniversalPersonSearch compact />
            <NotificationBell />
          </div>
        </div>}
        <main className={cn("app-main min-w-0 flex-1", isWindowFrame && "app-window-main")}>
          {!isMobile && !isWindowFrame && <div className="mb-4 flex items-center gap-2">
            <Button variant="ghost" size="sm" className="min-h-11 shrink-0 rounded-xl" onClick={goBack}>
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
            <UniversalPersonSearch className="max-w-52" />
            {sidebarCollapsed && <NotificationBell />}
          </div>}
          <Suspense fallback={<div role="status" className="grid min-h-[40vh] place-items-center text-muted-foreground">Cargando sección…</div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {!isWindowFrame && <SiriAssistant />}
      <BackgroundJobs />
      {isMobile && !isWindowFrame && <MobileBottomNav />}
      {!isWindowFrame && <AdaptiveViewport />}
      <NetworkStatusModal />
      <OfflineContextKeeper />
      <GlobalDataSync />
      <OriginBackgroundSync />
      <KeyboardAwareScroller />
      {!isWindowFrame && <AppWindowLayer />}
    </div>
  );
}
