import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import Investigacion from './Investigacion';
vi.mock('./Buscar', () => ({ default: () => <p>Archivo y catálogos abierto</p> }));
vi.mock('./Hipotesis', () => ({ default: () => <p>Hipótesis abiertas</p> }));
vi.mock('./Asistente', () => ({ default: () => <p>Conversación IA abierta</p> }));
vi.mock('./ResearchBrains', () => ({ default: () => <p>Análisis de personas y árbol abierto</p> }));
vi.mock('@/components/ResearchWorkflowPanel', () => ({ ResearchLogPanel: () => <p>Historial abierto</p> }));
afterEach(cleanup);
function show(path: string) { render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Investigacion /></MemoryRouter>); }
it('preserves old deep links inside four unified research sections', async () => {
  show('/investigacion?tab=hipotesis&lugar=Berna');
  expect(screen.getAllByRole('tab')).toHaveLength(4);
  expect(screen.getByRole('tab', { name: 'Revisar' })).toHaveAttribute('aria-selected', 'true');
  await screen.findByText('Hipótesis abiertas');
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'IA' }), { button: 0, ctrlKey: false });
  expect(await screen.findByText('Análisis de personas y árbol abierto')).toBeVisible();
});
it('falls back to the search section for an invalid tab', async () => {
  show('/investigacion?tab=toString');
  expect(await screen.findByText('Archivo y catálogos abierto')).toBeVisible();
});
