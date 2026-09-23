import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import GlobalDataSync from './GlobalDataSync';

const sync = vi.hoisted(() => ({
  userId: 'account-a',
  callbacks: new Map<string, () => void>(),
  subscriptions: new Map<string, (status: string) => void>(),
  client: { invalidateQueries: vi.fn() },
  remove: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: sync.userId } }) }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => sync.client }));
vi.mock('sonner', () => ({ toast: { info: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  channel: (name: string) => ({
    on: (_event: string, filter: { table: string }, callback: () => void) => { sync.callbacks.set(`${name}:${filter.table}`, callback); },
    subscribe: (callback?: (status: string) => void) => { if (callback) sync.subscriptions.set(name, callback); },
  }),
  removeChannel: sync.remove,
} }));
beforeEach(() => {
  vi.useFakeTimers(); sync.userId = 'account-a'; sync.callbacks.clear();
  sync.subscriptions.clear(); sync.client.invalidateQueries.mockClear();
});
afterEach(() => { cleanup(); delete document.body.dataset.geneiaiEditing; vi.useRealTimers(); });

it('flushes at the first deadline even when remote events keep arriving', () => {
  render(<GlobalDataSync />);
  const changed = sync.callbacks.get('global-sync-account-a:personas')!;
  act(() => { changed(); vi.advanceTimersByTime(400); changed(); vi.advanceTimersByTime(400); changed(); });
  expect(sync.client.invalidateQueries).not.toHaveBeenCalled();
  act(() => { vi.advanceTimersByTime(200); });
  expect(sync.client.invalidateQueries).toHaveBeenCalledTimes(1);
});

it('ignores late table, profile and reconnect callbacks after disposal', () => {
  const view = render(<GlobalDataSync />);
  const changed = sync.callbacks.get('global-sync-account-a:personas')!;
  const profile = sync.callbacks.get('profile-sync-account-a:profiles')!;
  const reconnect = sync.subscriptions.get('global-sync-account-a')!;
  reconnect('SUBSCRIBED'); view.unmount();
  act(() => { changed(); profile(); reconnect('SUBSCRIBED'); vi.advanceTimersByTime(2000); });
  expect(sync.client.invalidateQueries).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it('does not let the old account invalidate the replacement account', () => {
  const view = render(<GlobalDataSync />);
  const oldAccount = sync.callbacks.get('global-sync-account-a:personas')!;
  sync.userId = 'account-b'; view.rerender(<GlobalDataSync />);
  act(() => { oldAccount(); vi.advanceTimersByTime(1000); });
  expect(sync.client.invalidateQueries).not.toHaveBeenCalled();
  act(() => { sync.callbacks.get('global-sync-account-b:personas')!(); vi.advanceTimersByTime(1000); });
  expect(sync.client.invalidateQueries).toHaveBeenCalledTimes(1);
});
