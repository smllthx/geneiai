import { useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { Crosshair, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TreeViewport } from './treeViewport';

/** The viewport and controls never scale; only its genealogy content does. */
export default function TreeCanvas({ viewport, resetKey, editMode, children }: { viewport: TreeViewport; resetKey: string; editMode?: boolean; children: ReactNode }) {
  const surface = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => viewport.attach(surface.current!), [viewport]);
  useLayoutEffect(() => { viewport.reset(); }, [viewport, resetKey]);
  return <div className="relative mx-3 mb-24 h-[65dvh] min-h-[420px] overflow-hidden rounded-2xl border bg-card/30 md:mx-6 md:mb-8" data-tree-viewport>
    <div ref={surface} data-tree-gesture-surface role="group" aria-label="Árbol interactivo. Pellizca para acercar o alejar y arrastra para moverte." tabIndex={0} className="absolute inset-0 touch-none select-none overflow-hidden" style={{ overscrollBehavior: 'none', WebkitUserSelect: 'none' }}>
      <div data-tree-content data-tree-no-gesture={editMode || undefined} className="absolute left-1/2 top-1/2 w-max origin-center" style={{ transform: 'translate3d(calc(-50% + var(--tree-x, 0px)), calc(-50% + var(--tree-y, 0px)), 0) scale(var(--tree-scale, 0.88))', willChange: 'transform' }}>{children}</div>
    </div>
    <div data-tree-no-gesture className="absolute right-3 top-3 z-10 rounded-2xl border bg-background/95 p-2 shadow-sm"><TreeZoomControls viewport={viewport} /></div>
    <p className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-background/90 px-3 py-1 text-xs text-muted-foreground">Pellizca para ampliar · arrastra para explorar</p>
  </div>;
}

export function TreeZoomControls({ viewport }: { viewport: TreeViewport }) {
  const scale = useSyncExternalStore(viewport.subscribe, viewport.getScale, viewport.getScale);
  return <div className="flex items-center gap-2">
    <Button variant="outline" size="icon" onClick={viewport.zoomOut} aria-label="Alejar árbol"><ZoomOut className="h-4 w-4" /></Button>
    <span className="min-w-10 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
    <Button variant="outline" size="icon" onClick={viewport.zoomIn} aria-label="Acercar árbol"><ZoomIn className="h-4 w-4" /></Button>
    <Button variant="outline" size="icon" onClick={viewport.reset} aria-label="Centrar árbol"><Crosshair className="h-4 w-4" /></Button>
  </div>;
}
