import { lazy } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppLayout from "./AppLayout";

const device = vi.hoisted(() => ({ mobile: true }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => device.mobile }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, signOut: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/routePrefetch", () => ({ prefetchRoute: vi.fn() }));
vi.mock("@/components/UniversalPersonSearch", () => ({ default: () => <button>Buscar persona único</button> }));
vi.mock("@/components/NotificationBell", () => ({ default: () => <button>Notificaciones únicas</button> }));
vi.mock("@/components/BackgroundJobs", () => ({ default: () => null }));
vi.mock("@/components/SiriAssistant", () => ({ default: () => null }));
vi.mock("@/components/AdaptiveViewport", () => ({ default: () => null }));
vi.mock("@/components/AppUpdateNotifier", () => ({ default: () => null }));
vi.mock("@/components/GlobalDataSync", () => ({ default: () => null }));
vi.mock("@/components/OriginBackgroundSync", () => ({ default: () => null }));
vi.mock("@/components/NetworkStatusModal", () => ({ default: () => null }));
vi.mock("@/components/OfflineContextKeeper", () => ({ default: () => null }));
vi.mock("@/components/AppWindowLayer", () => ({ default: () => null }));
vi.mock("@/components/KeyboardAwareScroller", () => ({ default: () => null }));

function show(pending = false) {
  const Pending = lazy(() => new Promise<{ default: () => JSX.Element }>(() => {}));
  return render(<MemoryRouter initialEntries={["/inicio"]} future={{ v7_startTransition: false, v7_relativeSplatPath: true }}>
    <Routes><Route element={<AppLayout />}>
      <Route path="/inicio" element={<p>Página inicial</p>} />
      <Route path="/personas" element={pending ? <Pending /> : <p>Lista de personas</p>} />
    </Route></Routes>
  </MemoryRouter>);
}

beforeEach(() => {
  device.mobile = true;
  localStorage.clear();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("navigation shell", () => {
  it("mounts one search and notification on mobile and closes the menu after selection", async () => {
    show();
    expect(screen.getAllByText("Buscar persona único")).toHaveLength(1);
    expect(screen.getAllByText("Notificaciones únicas")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Archivo familiar" }));
    fireEvent.click(screen.getByRole("link", { name: "Personas" }));
    await screen.findByText("Lista de personas");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it.each([true, false])("uses the same section names and distinct destinations on mobile=%s", mobile => {
    device.mobile = mobile;
    show();
    if (mobile) fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    const menu = within(screen.getByRole("navigation", { name: "Secciones de GENEAI" }));
    for (const label of ["Árbol Genealógico", "Descubrimientos", "ADN", "Fotos", "Investigación"]) {
      expect(menu.getByRole("button", { name: label })).toHaveAttribute("aria-expanded", "false");
    }
    fireEvent.click(menu.getByRole("button", { name: "Árbol Genealógico" }));
    expect(menu.getByRole("link", {name: "Mi árbol familiar"})).toHaveAttribute("href", "/arbol");
    expect(menu.getByRole("link", {name: "Consistency Checker"})).toHaveAttribute("href", "/consistencia");
    expect(menu.getByRole("link", {name: "Informe de relaciones"})).toHaveAttribute("href", "/informe-de-relaciones");
    expect(menu.getByRole("link", {name: "Infografías Familiares"})).toHaveAttribute("href", "/cuadros-ia");
    fireEvent.click(menu.getByRole("button", { name: "ADN" }));
    expect(menu.queryByRole("link", { name: "Mi árbol familiar" })).toBeNull();
    expect(menu.getByRole("link", { name: "Estimación Étnica" })).toHaveAttribute("href", "/estimacion-etnica");
    for (const name of ["Coincidencias de ADN", "Orígenes Antiguos", "Activar kit de ADN", "Administrar kits de ADN", "Ordenar kits de ADN"]) {
      const link = menu.getByRole("link", { name: `${name} (MyHeritage, nueva pestaña)` });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("href")).toMatch(/^https:\/\/www\.myheritage\.es\//);
    }
    fireEvent.click(menu.getByRole("button", { name: "Fotos" }));
    expect(menu.getByRole("link", { name: "LiveMemory™ (MyHeritage, nueva pestaña)" })).toHaveAttribute("href", "https://www.myheritage.es/live-memory");
    expect(menu.getByRole("link", { name: "Bandeja de entrada" })).toHaveAttribute("href", "/bandeja-de-entrada");
  });

  it("keeps a single search and notification when the desktop sidebar is collapsed", () => {
    device.mobile = false;
    show();
    expect(screen.getAllByText("Buscar persona único")).toHaveLength(1);
    expect(screen.getAllByText("Notificaciones únicas")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar menú" }));
    expect(screen.getAllByText("Buscar persona único")).toHaveLength(1);
    expect(screen.getAllByText("Notificaciones únicas")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Ocultar menú" })).not.toBeInTheDocument();
  });

  it("preserves the navigation while a new section is loading", async () => {
    device.mobile = false;
    show(true);
    fireEvent.click(screen.getByRole("button", { name: "Archivo familiar" }));
    fireEvent.click(screen.getByRole("link", { name: "Personas" }));
    await screen.findByRole("status");
    expect(screen.getByRole("button", { name: "Buscar persona único" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Ocultar menú" })).toBeVisible();
  });
});
