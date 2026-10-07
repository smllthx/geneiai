import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Buscar from './Buscar';
const fixtures = vi.hoisted(() => ({ fail: false }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'research-user' } }) }));
vi.mock('@/lib/peopleData', async (importOriginal) => ({ ...await importOriginal<typeof import('@/lib/peopleData')>(), getActiveTreeId: async () => 'tree', fetchAllPeople: async () => [{ id: 'p1', nombres: 'María', apellidos: 'Ríos' }] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => {
  const result = { data: table === 'lugares' ? [{ id: 'place1', ciudad: 'Antofagasta', pais: 'Chile' }] : [], error: fixtures.fail ? new Error('offline') : null };
  const query = { select: () => query, order: () => query, range: () => query, or: () => { if (table === "hipotesis") throw new Error("column hipotesis.arbol_id does not exist"); return query; }, abortSignal: () => query, then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve) };
  return query;
} } }));
beforeEach(() => { HTMLElement.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { cleanup(); fixtures.fail = false; });
function show(path = '/buscar') {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/buscar" element={<Buscar />} /><Route path="/investigacion" element={<p>Consulta IA</p>} /></Routes></MemoryRouter></QueryClientProvider>);
}
it('connects the form to provider links and carries the selected place to its catalog', async () => {
  show();
  fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'María' } });
  fireEvent.change(screen.getByLabelText('Lugar'), { target: { value: 'Antofagasta, Chile' } });
  fireEvent.change(screen.getByLabelText('Año aproximado'), { target: { value: '1900' } });
  fireEvent.click(screen.getByRole('button', { name: /^Buscar$/ }));
  const records = screen.getByRole('link', { name: /FamilySearch · Registros/ });
  expect(new URL(records.getAttribute('href')!).searchParams.get('q.birthLikePlace')).toBe('Antofagasta, Chile');
  expect(records).toHaveAttribute('data-external-browser', 'true');
  const placeLink = await screen.findByRole('link', { name: /Catálogo de este lugar/ });
  expect(new URL(placeLink.getAttribute('href')!).searchParams.get('query')).toBe('+place:"Antofagasta, Chile"');
  expect(screen.getByRole('link', { name: /Antofagasta, Chile/ })).toHaveAttribute('href', '/lugares?lugar=place1');
});
it('restores criteria and catalog mode from a shared URL', () => {
  show('/buscar?modo=catalogo&lugar=Berna&palabras=Parroquia&campo=title');
  expect(screen.getByLabelText('Lugar')).toHaveValue('Berna');
  expect(screen.getByLabelText('Título, tema o referencia')).toHaveValue('Parroquia');
  expect(screen.getByRole('button', { name: /Catálogo/ })).toHaveAttribute('aria-pressed', 'true');
});
it('keeps external search usable when the private archive fails', async () => {
  fixtures.fail = true;
  show('/buscar?lugar=Antofagasta');
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo consultar tu archivo'));
  expect(screen.getByRole('link', { name: /FamilySearch · Catálogo/ })).toBeVisible();
  expect(screen.queryByText(/Sin coincidencias/)).not.toBeInTheDocument();
});
it('opens the existing AI flow from the working form', () => {
  show('/buscar?lugar=Berna');
  fireEvent.click(screen.getByRole('button', { name: 'Buscar con IA' }));
  expect(screen.getByText('Consulta IA')).toBeInTheDocument();
});
