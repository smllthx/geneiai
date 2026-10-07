import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import ResearchBrains from './ResearchBrains';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user' } }) }));
vi.mock('@/hooks/use-realtime-reload', () => ({ useRealtimeReload: () => 0 }));
vi.mock('@/lib/peopleData', () => ({ getActiveTreeId: async () => 'tree', fetchAllRelations: async () => [], fetchAllPeople: async () => [{ id: 'p1', nombres: 'María', apellidos: 'Ríos' }, { id: 'p2', nombres: 'Juan', apellidos: 'Ríos' }] }));
vi.mock('@/components/TreeInsights', () => ({ default: () => null }));
vi.mock('@/components/PersonaSmartInsights', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }) } }));
afterEach(cleanup);
function Location() { return <output data-testid="location">{useLocation().search}</output>; }
it('transfers the selected person to evidence search and to the assistant prompt', async () => {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/investigacion?tab=cerebros&persona=p2']}><ResearchBrains /><Location /></MemoryRouter></QueryClientProvider>);
  const selection = await screen.findByRole('combobox', { name: 'Persona a investigar' });
  expect(selection).toHaveValue('p2');
  fireEvent.click(screen.getByRole('button', { name: 'Verificar coherencia' }));
  expect(await screen.findByText('No se encontraron problemas de coherencia.')).toBeVisible();
  // The action URLs carry the explicit selected context rather than opening a generic conversation.
  fireEvent.click(screen.getByRole('button', { name: 'Genealogista IA' }));
  const query = new URLSearchParams(screen.getByTestId('location').textContent!);
  expect(query.get('persona')).toBe('p2');
  expect(query.get('prompt')).toContain('Juan Ríos, ID p2');
});
