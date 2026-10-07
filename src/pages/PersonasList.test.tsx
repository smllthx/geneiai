import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import PersonasList from './PersonasList';
vi.mock('@/lib/peopleData', () => ({ getActiveTreeId: async () => 'tree', fetchAllRelations: async () => [], withTreeScope: (row: unknown) => row, fetchAllPeople: async (select: string) => [{ id: 'p1', nombres: 'María', apellidos: 'Ríos', certeza: 'probable', foto_url: select.split(',').includes('foto_url') ? 'https://example.com/portrait.jpg' : null }] }));
vi.mock('@/components/VirtualList', () => ({ default: ({ items, renderItem }: { items: unknown[]; renderItem: (item: unknown) => React.ReactNode }) => <>{items.map(renderItem)}</> }));
afterEach(cleanup);
it('shows uploaded portraits in the people list', async () => {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><PersonasList /></MemoryRouter>);
  expect(await screen.findByRole('img', { name: 'Retrato de María Ríos' })).toHaveAttribute('src', 'https://example.com/portrait.jpg');
});
