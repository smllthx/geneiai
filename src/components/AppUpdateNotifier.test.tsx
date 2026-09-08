import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AppUpdateNotifier from './AppUpdateNotifier';
import { fetchAppRelease, currentRelease } from '@/lib/appRelease';
import { applyAppUpdate } from '@/lib/pwa';
vi.mock('@/lib/appRelease', () => ({ currentRelease: { version: '3.0.1', changes: ['Árbol más ligero'], publishedAt: '2026-09-08' }, fetchAppRelease: vi.fn() }));
vi.mock('@/lib/pwa', () => ({ applyAppUpdate: vi.fn(async () => 'requested'), clearAppCache: vi.fn(), isAppEditing: () => false }));
afterEach(() => { localStorage.clear(); vi.clearAllMocks(); });
it('shows release details, checks returning sessions and applies an available update', async () => {
  vi.mocked(fetchAppRelease).mockResolvedValue({ ...currentRelease, version: '3.0.2', changes: ['Carga recuperada'] });
  render(<AppUpdateNotifier />);
  expect(await screen.findByText(/Actualización disponible.*3.0.2/)).toBeInTheDocument();
  expect(screen.getByText('Carga recuperada')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar ahora' }));
  await waitFor(() => expect(applyAppUpdate).toHaveBeenCalledTimes(1));
});
it('dismisses installed-release notes without clearing account storage', async () => {
  localStorage.setItem('account-draft-fixture', 'untouched');
  vi.mocked(fetchAppRelease).mockResolvedValue(currentRelease);
  await act(async () => { render(<AppUpdateNotifier />); });
  fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
  expect(localStorage.getItem('geneai:release-seen')).toBe('3.0.1');
  expect(localStorage.getItem('account-draft-fixture')).toBe('untouched');
});
