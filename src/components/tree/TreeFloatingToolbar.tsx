import { Filter, Home, Maximize2, Minus, Plus, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import TreeViewSelector from "./TreeViewSelector";
import type { TreeViewMode } from "./types";

type TreeFloatingToolbarProps = {
  view: TreeViewMode;
  scale: number;
  onViewChange: (view: TreeViewMode) => void;
  onOptions: () => void;
  onHome: () => void;
  onFullscreen: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
};

export default function TreeFloatingToolbar({
  view,
  scale,
  onViewChange,
  onOptions,
  onHome,
  onFullscreen,
  onZoomIn,
  onZoomOut,
  onCenter,
}: TreeFloatingToolbarProps) {
  return (
    <div className="absolute right-4 top-24 z-20 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2">
      <TreeViewSelector value={view} onChange={onViewChange} />
      <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-sm">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onOptions} aria-label="Filtros y opciones">
          <Filter className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onHome} aria-label="Inicio del árbol">
          <Home className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onFullscreen} aria-label="Pantalla completa">
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onCenter} aria-label="Centrar persona">
          <ScanSearch className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onZoomOut} aria-label="Alejar">
          <Minus className="h-4 w-4" />
        </Button>
        <span className="min-w-10 text-center text-[11px] font-medium text-slate-500">{Math.round(scale * 100)}%</span>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onZoomIn} aria-label="Acercar">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
