import { lazy } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    fireEvent.click(screen.getByRole("link", { name: "Personas" }));
    await screen.findByText("Lista de personas");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
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
    fireEvent.click(screen.getByRole("link", { name: "Personas" }));
    await screen.findByRole("status");
    expect(screen.getByRole("button", { name: "Buscar persona único" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Ocultar menú" })).toBeVisible();
  });
});
