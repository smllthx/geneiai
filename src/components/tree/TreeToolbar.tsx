import { Crosshair, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TreeFilters } from "./types";

type TreeToolbarProps = {
  filters: TreeFilters;
  onFiltersChange: (filters: TreeFilters) => void;
  onCenter: () => void;
  onAddPerson: () => void;
};

const FilterButton = ({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
      active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted"
    }`}
  >
    {children}
  </button>
);

export default function TreeToolbar({ filters, onFiltersChange, onCenter, onAddPerson }: TreeToolbarProps) {
  const setFilter = <K extends keyof TreeFilters>(key: K, value: TreeFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="absolute left-4 right-4 top-4 z-20 rounded-2xl border border-border bg-card/95 p-3 shadow-sm backdrop-blur">
      <div className="mb-3 flex flex-col gap-2 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">GENEAI</p>
          <h1 className="text-xl font-semibold leading-tight text-foreground">Árbol</h1>
        </div>
        <Button size="sm" className="rounded-full" onClick={onAddPerson}>
          <UserPlus className="h-4 w-4" /> Agregar persona
        </Button>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={filters.query}
            onChange={(event) => setFilter("query", event.target.value)}
            placeholder="Buscar persona, apellido, lugar o ID"
            className="h-10 rounded-full border-border bg-background pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterButton active={filters.paternal} onClick={() => setFilter("paternal", !filters.paternal)}>
            Línea paterna
          </FilterButton>
          <FilterButton active={filters.maternal} onClick={() => setFilter("maternal", !filters.maternal)}>
            Línea materna
          </FilterButton>
          <FilterButton active={filters.noSources} onClick={() => setFilter("noSources", !filters.noSources)}>
            Sin fuentes
          </FilterButton>
          <FilterButton active={filters.withSources} onClick={() => setFilter("withSources", !filters.withSources)}>
            Con fuentes
          </FilterButton>
          <FilterButton active={filters.incomplete} onClick={() => setFilter("incomplete", !filters.incomplete)}>
            Incompletos
          </FilterButton>
          <Button variant="outline" size="sm" className="rounded-full" onClick={onCenter}>
            <Crosshair className="h-4 w-4" /> Centrar
          </Button>
        </div>
      </div>
    </div>
  );
}
