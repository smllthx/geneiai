import { useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { Crosshair, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TreeViewport } from './treeViewport';

/** The viewport and controls never scale; only its genealogy content does. */
export default function TreeCanvas({ viewport, resetKey, editMode, fan, children }: { viewport: TreeViewport; resetKey: string; editMode?: boolean; fan?: boolean; children: ReactNode }) {
  const surface = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => viewport.attach(surface.current!), [viewport]);
  useLayoutEffect(() => { viewport.frame(); }, [viewport, resetKey]);
  return <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border bg-card/30" data-tree-viewport>
    <div ref={surface} data-tree-gesture-surface role="group" aria-label="Árbol interactivo. Pellizca para acercar o alejar y arrastra para moverte." tabIndex={0} className="absolute inset-0 touch-none select-none overflow-hidden" style={{ overscrollBehavior: 'none', WebkitUserSelect: 'none' }}>
      <div data-tree-content data-tree-no-gesture={editMode || undefined} className="absolute left-1/2 top-1/2 w-max origin-center" style={{ transform: 'translate3d(calc(-50% + var(--tree-x, 0px)), calc(-50% + var(--tree-y, 0px)), 0) scale(var(--tree-scale, 0.88))', willChange: 'transform' }}>{children}</div>
    </div>
    <div data-tree-no-gesture className="absolute right-3 top-3 z-10 rounded-2xl border bg-background/95 p-2 shadow-sm"><TreeZoomControls viewport={viewport} fan={fan} /></div>
  </div>;
}

export function TreeZoomControls({ viewport, fan }: { viewport: TreeViewport; fan?: boolean }) {
  const scale = useSyncExternalStore(viewport.subscribe, viewport.getScale, viewport.getScale);
  return <div className="flex items-center gap-2">
    <Button variant="outline" size="icon" onClick={viewport.zoomOut} aria-label="Alejar árbol"><ZoomOut className="h-4 w-4" /></Button>
    <span className="min-w-10 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
    <Button variant="outline" size="icon" onClick={viewport.zoomIn} aria-label="Acercar árbol"><ZoomIn className="h-4 w-4" /></Button>
    <Button variant="outline" size={fan ? "sm" : "icon"} onClick={viewport.reset} aria-label={fan ? "Ver abanico completo" : "Centrar árbol"} title={fan ? "Ver abanico completo" : "Centrar árbol"}><Crosshair className="h-4 w-4" />{fan && <span className="ml-1 text-xs">Ajustar</span>}</Button>
  </div>;
}
