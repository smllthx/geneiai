import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import GlobalDataSync from "./GlobalDataSync";

const sync = vi.hoisted(() => ({
  callbacks: new Map<string, () => void>(),
  subscribe: null as null | ((status: string) => void),
  invalidate: vi.fn(), remove: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "same-user" } }) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: sync.invalidate }) }));
vi.mock("sonner", () => ({ toast: { info: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  channel: () => ({
    on: (_event: string, filter: { table: string }, callback: () => void) => { sync.callbacks.set(filter.table, callback); },
    subscribe: (callback?: (status: string) => void) => { if (callback) sync.subscribe = callback; },
  }), removeChannel: sync.remove,
} }));
beforeEach(() => { vi.useFakeTimers(); sync.callbacks.clear(); sync.invalidate.mockClear(); });
afterEach(() => { cleanup(); delete document.body.dataset.geneiaiEditing; vi.useRealTimers(); });

it("refreshes once when returning to the app and when realtime reconnects", () => {
  render(<GlobalDataSync />);
  sync.subscribe?.("SUBSCRIBED");
  act(() => {
    window.dispatchEvent(new Event("pageshow"));
    window.dispatchEvent(new Event("online"));
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(1000);
  });
  expect(sync.invalidate).toHaveBeenCalledTimes(1);
  act(() => { sync.subscribe?.("SUBSCRIBED"); vi.advanceTimersByTime(1000); });
  expect(sync.invalidate).toHaveBeenCalledTimes(2);
});

it("defers remote refresh until editing finishes and retains changes to multiple tables", () => {
  const changed = vi.fn();
  window.addEventListener("genaia:data-changed", changed);
  render(<GlobalDataSync />);
  document.body.dataset.geneiaiEditing = "1";
  act(() => {
    sync.callbacks.get("personas")?.();
    sync.callbacks.get("relaciones")?.();
    vi.advanceTimersByTime(2500);
  });
  expect(changed).not.toHaveBeenCalled();
  delete document.body.dataset.geneiaiEditing;
  act(() => { vi.advanceTimersByTime(1000); });
  expect(changed).toHaveBeenCalledTimes(1);
  expect((changed.mock.calls[0][0] as CustomEvent).detail.table).toBeUndefined();
  expect(sync.invalidate).toHaveBeenCalledTimes(1);
  window.removeEventListener("genaia:data-changed", changed);
});

it("removes pending refreshes when the session is unmounted", () => {
  const view = render(<GlobalDataSync />);
  act(() => { sync.callbacks.get("personas")?.(); });
  view.unmount();
  act(() => { vi.advanceTimersByTime(2000); window.dispatchEvent(new Event("online")); vi.advanceTimersByTime(2000); });
  expect(sync.invalidate).not.toHaveBeenCalled();
});

it('refreshes the shared profile and recovers missed events while foregrounded', () => {
  const changed = vi.fn();
  window.addEventListener('genaia:data-changed', changed);
  const view = render(<GlobalDataSync />);
  act(() => { sync.callbacks.get('profiles')?.(); vi.advanceTimersByTime(1000); });
  expect(sync.invalidate).toHaveBeenCalledTimes(1);
  expect((changed.mock.calls[0][0] as CustomEvent).detail.table).toBeUndefined();
  act(() => { vi.advanceTimersByTime(60_000); });
  expect(sync.invalidate).toHaveBeenCalledTimes(2);
  view.unmount();
  act(() => { vi.advanceTimersByTime(120_000); });
  expect(sync.invalidate).toHaveBeenCalledTimes(2);
  window.removeEventListener('genaia:data-changed', changed);
});
