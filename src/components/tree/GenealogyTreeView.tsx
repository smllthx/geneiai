import { useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { buildGenealogyLayout } from "./genealogyLayout";
import PersonNode from "./PersonNode";
import PersonSidePanel from "./PersonSidePanel";
import TreeToolbar from "./TreeToolbar";
import type { GenealogyPerson, TreeEdge, TreeFilters, TreeNode } from "./types";

const NODE_W = 240;
const NODE_H = 172;
const CENTER_X = 850;
const CENTER_Y = 420;

const edgeColor: Record<TreeEdge["lineage"], string> = {
  paterna: "#60a5fa",
  materna: "#fb7185",
  central: "#94a3b8",
};

const defaultFilters: TreeFilters = {
  query: "",
  paternal: false,
  maternal: false,
  noSources: false,
  incomplete: false,
};

const nodeCenter = (node: TreeNode) => ({
  x: CENTER_X + node.position.x + NODE_W / 2,
  y: CENTER_Y + node.position.y + NODE_H / 2,
});

const edgePath = (source: TreeNode, target: TreeNode) => {
  const a = nodeCenter(source);
  const b = nodeCenter(target);
  const sourceY = a.y + NODE_H / 2 - 18;
  const targetY = b.y - NODE_H / 2 + 18;
  const midY = sourceY + (targetY - sourceY) / 2;
  return `M ${a.x} ${sourceY} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${targetY}`;
};

const matchesFilters = (person: GenealogyPerson, filters: TreeFilters) => {
  const q = filters.query.trim().toLowerCase();
  const text = `${person.givenNames} ${person.surnames} ${person.mainPlace ?? ""} ${person.id}`.toLowerCase();
  if (q && !text.includes(q)) return false;
  if (filters.paternal && person.lineage !== "paterna" && person.lineage !== "central") return false;
  if (filters.maternal && person.lineage !== "materna" && person.lineage !== "central") return false;
  if (filters.noSources && person.sourcesCount > 0) return false;
  if (filters.incomplete && !person.incomplete) return false;
  return true;
};

export default function GenealogyTreeView() {
  const [{ nodes, edges }] = useState(() => buildGenealogyLayout());
  const [selected, setSelected] = useState<GenealogyPerson | null>(() => nodes.find((node) => node.id === "PUQT-GS2")?.data.person ?? null);
  const [filters, setFilters] = useState<TreeFilters>(defaultFilters);
  const [scale, setScale] = useState(0.88);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const visibleIds = useMemo(() => new Set(nodes.filter((node) => matchesFilters(node.data.person, filters)).map((node) => node.id)), [nodes, filters]);
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const centerTree = () => {
    setScale(0.88);
    setOffset({ x: 0, y: 0 });
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.06 : 0.06;
    setScale((current) => Math.min(1.55, Math.max(0.45, Number((current + delta).toFixed(2)))));
  };

  const handleAction = (action: "profile" | "relative" | "ai" | "expand", person: GenealogyPerson) => {
    setSelected(person);
    if (action === "profile") toast.info(`Abrir perfil de ${person.givenNames}`);
    if (action === "relative") toast.info(`Agregar familiar a ${person.givenNames}`);
    if (action === "ai") toast.info(`Buscar evidencia con IA para ${person.givenNames}`);
    if (action === "expand") toast.info(`Expandir rama de ${person.givenNames}`);
  };

  return (
    <div className="-mx-3 -my-3 min-h-[calc(100vh-1px)] bg-slate-100 md:-mx-6 md:-my-6">
      <div
        ref={viewportRef}
        className="relative h-[calc(100vh-1px)] min-h-[720px] overflow-hidden bg-[radial-gradient(circle_at_1px_1px,#cbd5e1_1px,transparent_0)] [background-size:28px_28px]"
        onWheel={handleWheel}
        onMouseDown={(event) => {
          if ((event.target as HTMLElement).closest("button,article,input")) return;
          setDrag({ x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y });
        }}
        onMouseMove={(event) => {
          if (!drag) return;
          setOffset({ x: drag.ox + event.clientX - drag.x, y: drag.oy + event.clientY - drag.y });
        }}
        onMouseUp={() => setDrag(null)}
        onMouseLeave={() => setDrag(null)}
      >
        <TreeToolbar filters={filters} onFiltersChange={setFilters} onCenter={centerTree} />

        <div className="absolute left-4 top-24 z-10 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm">
          <div className="grid gap-1">
            <Button variant="ghost" size="icon" onClick={() => setScale((value) => Math.min(1.55, value + 0.08))} aria-label="Acercar">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setScale((value) => Math.max(0.45, value - 0.08))} aria-label="Alejar">
              <Minus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={centerTree} aria-label="Centrar árbol">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1 text-center text-[10px] text-slate-500">{Math.round(scale * 100)}%</p>
        </div>

        <div className="absolute bottom-4 left-4 z-10 hidden rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm sm:block">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Mini mapa</p>
          <div className="relative h-24 w-40 rounded-xl bg-slate-100">
            {nodes.map((node) => (
              <span
                key={node.id}
                className={`absolute h-2 w-3 rounded-sm ${node.data.person.lineage === "materna" ? "bg-rose-400" : node.data.person.lineage === "paterna" ? "bg-sky-400" : "bg-emerald-500"}`}
                style={{ left: `${50 + node.position.x / 16}%`, top: `${50 + node.position.y / 12}%` }}
              />
            ))}
          </div>
        </div>

        <div
          className="absolute left-1/2 top-1/2 h-[900px] w-[1700px] origin-center"
          style={{
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
          }}
        >
          <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            {edges.map((edge) => {
              const source = nodesById.get(edge.source);
              const target = nodesById.get(edge.target);
              if (!source || !target) return null;
              const hidden = hasActiveFilters && (!visibleIds.has(edge.source) || !visibleIds.has(edge.target));
              return (
                <path
                  key={edge.id}
                  d={edgePath(source, target)}
                  fill="none"
                  stroke={edgeColor[edge.lineage]}
                  strokeLinecap="round"
                  strokeWidth={hidden ? 1.5 : 3}
                  opacity={hidden ? 0.16 : 0.8}
                />
              );
            })}
          </svg>

          {nodes.map((node) => (
            <div
              key={node.id}
              className="absolute"
              style={{ left: CENTER_X + node.position.x, top: CENTER_Y + node.position.y }}
            >
              <PersonNode
                person={node.data.person}
                selected={selected?.id === node.id}
                dimmed={hasActiveFilters && !visibleIds.has(node.id)}
                onSelect={setSelected}
                onAction={handleAction}
              />
            </div>
          ))}
        </div>

        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs text-slate-600 shadow-sm">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400" /> paterna</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" /> materna</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> central</span>
        </div>

        <PersonSidePanel
          person={selected}
          onClose={() => setSelected(null)}
          onEdit={(person) => toast.info(`Editar ${person.givenNames}`)}
          onAiEvidence={(person) => toast.info(`Buscar evidencia con IA para ${person.givenNames}`)}
        />
      </div>
    </div>
  );
}

