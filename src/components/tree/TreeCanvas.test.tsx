import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import TreeCanvas from './TreeCanvas';
import { anchoredCamera, createTreeViewport } from './treeViewport';

afterEach(cleanup);
function pointer(surface: Element, type: string, id: number, x: number, y: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, button: 0 });
  surface.dispatchEvent(event);
}
it('keeps the world point beneath the fingers when pinching and moving', () => {
  const camera = anchoredCamera({ x: 20, y: 10, scale: 1 }, { x: 100, y: 60 }, { x: 120, y: 70 }, 2);
  expect(camera).toEqual({ x: -40, y: -30, scale: 2 });
  expect((120 - camera.x) / camera.scale).toBe(80);
});
it('pinches the genealogy content without transforming the viewport or toolbar', () => {
  const viewport = createTreeViewport();
  const { container } = render(<TreeCanvas viewport={viewport} resetKey="person:ancestors"><div>Familia</div></TreeCanvas>);
  const surface = screen.getByRole('group');
  Object.assign(surface, { hasPointerCapture: () => false, setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() });
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 390, bottom: 420, width: 390, height: 420, toJSON: () => ({}) });
  pointer(surface, 'pointerdown', 1, 100, 100); pointer(surface, 'pointerdown', 2, 200, 100);
  pointer(surface, 'pointermove', 2, 300, 100);
  expect(viewport.getCamera().scale).toBeCloseTo(1.76);
  pointer(surface, 'pointermove', 2, 150, 100);
  expect(viewport.getCamera().scale).toBeCloseTo(0.44);
  expect((container.querySelector('[data-tree-viewport]') as HTMLElement).style.transform).toBe('');
  expect(screen.getByRole('button', { name: 'Acercar árbol' }).closest('[data-tree-content]')).toBeNull();
  pointer(surface, 'pointerup', 1, 100, 100); pointer(surface, 'pointerup', 2, 150, 100);
});
it('preserves relationship drag operations in editing mode', () => {
  const viewport = createTreeViewport();
  render(<TreeCanvas viewport={viewport} resetKey="edit" editMode><button draggable>Persona</button></TreeCanvas>);
  const drag = new Event('dragstart', { bubbles: true, cancelable: true });
  fireEvent(screen.getByRole('button', { name: 'Persona' }), drag);
  expect(drag.defaultPrevented).toBe(false);
});
