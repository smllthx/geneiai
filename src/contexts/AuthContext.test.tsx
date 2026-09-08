import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

const auth = vi.hoisted(() => ({
  callback: null as null | ((event: string, session: any) => void),
  getSession: vi.fn(), signOut: vi.fn(), check: vi.fn(), unsubscribe: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ backendConfigurationError: null, supabase: { auth: {
  getSession: auth.getSession, signOut: auth.signOut,
  onAuthStateChange: (callback: typeof auth.callback) => {
    auth.callback = callback;
    return { data: { subscription: { unsubscribe: auth.unsubscribe } } };
  },
} } }));
vi.mock('@/lib/backendConnection', () => ({ verifyServerBackend: auth.check }));
vi.mock('@/lib/devicePasskey', () => ({ clearDeviceUnlock: vi.fn() }));
const session = (id: string) => ({ user: { id } });
function Probe() {
  const { user, signOut } = useAuth();
  const [draft, setDraft] = useState('');
  return <><p data-testid="identity">{user?.id ?? 'signed-out'}</p><input aria-label="Borrador" value={draft} onChange={e => setDraft(e.target.value)} /><button onClick={() => void signOut()}>Salir</button></>;
}
function mount() {
  const client = new QueryClient();
  return { client, view: render(<QueryClientProvider client={client}><AuthProvider><Probe /></AuthProvider></QueryClientProvider>) };
}
beforeEach(() => {
  vi.stubEnv('PROD', true);
  auth.callback = null;
  auth.getSession.mockReset().mockResolvedValue({ data: { session: session('A') }, error: null });
  auth.check.mockReset().mockResolvedValue(undefined);
  auth.signOut.mockReset().mockResolvedValue({ error: null });
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

it('removes cached queries and local drafts on account changes', async () => {
  const { client } = mount();
  await screen.findByText('A');
  client.setQueryData(['people'], [{ private: 'A' }]);
  fireEvent.change(screen.getByLabelText('Borrador'), { target: { value: 'private A draft' } });
  act(() => auth.callback?.('SIGNED_IN', session('B')));
  expect(screen.getByTestId('identity').textContent).toBe('B');
  expect(client.getQueryData(['people'])).toBeUndefined();
  expect((screen.getByLabelText('Borrador') as HTMLInputElement).value).toBe('');
});

it('does not restore an old session that arrives after sign-out', async () => {
  let finish!: (value: unknown) => void;
  auth.getSession.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  mount();
  await waitFor(() => expect(auth.getSession).toHaveBeenCalled());
  act(() => auth.callback?.('SIGNED_OUT', null));
  await act(async () => finish({ data: { session: session('A') }, error: null }));
  expect(screen.getByTestId('identity').textContent).toBe('signed-out');
});

it('blocks login while the server identity is unavailable and allows retry without signing out', async () => {
  auth.check.mockRejectedValueOnce(new Error('Conexión GENEAI no verificada'));
  mount();
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(auth.getSession).not.toHaveBeenCalled();
  expect(auth.signOut).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Volver a intentar' }));
  await screen.findByText('A');
});

it('signs out only this device', async () => {
  mount();
  await screen.findByText('A');
  fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
  await screen.findByText('signed-out');
  expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
});
