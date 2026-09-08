import { ancestorLayers } from "@/lib/treeRendering";
import type { TreeEdge, TreeNode } from "./types";

type FanChartViewProps = {
  nodes: TreeNode[];
  edges: TreeEdge[];
  centerId: string;
  onSelect: (id: string) => void;
};

const COLORS = ["#dbeafe", "#dcfce7", "#f5d0fe", "#fef3c7", "#e0e7ff", "#fee2e2"];

export default function FanChartView({ nodes, edges, centerId, onSelect }: FanChartViewProps) {
  const center = nodes.find((node) => node.id === centerId) ?? nodes[0];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const layers = center ? ancestorLayers(center.id, 4, (id) => {
    const parents = edges.filter((edge) => edge.target === id && ["padre", "madre", "hijo"].includes(edge.type));
    const father = parents.find((edge) => edge.type === "padre")?.source ?? parents.find((edge) => edge.type === "hijo")?.source ?? null;
    const mother = parents.find((edge) => edge.type === "madre")?.source ?? null;
    return [father, mother];
  }) : [];
  const rings = layers.slice(1).map((layer) => layer.map((id) => id ? byId.get(id) : undefined));

  return (
    <div className="absolute inset-0 grid place-items-center p-8">
      <div className="relative aspect-square w-[min(86vw,760px)] rounded-full border border-slate-200 bg-white/80 shadow-sm">
        {center && (
          <button
            type="button"
            onClick={() => onSelect(center.id)}
            className="absolute left-1/2 top-1/2 z-10 grid h-32 w-32 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-emerald-200 bg-white p-3 text-center shadow-md"
          >
            <span className="text-xs font-semibold text-slate-900">{center.data.person.givenNames}</span>
            <span className="text-[10px] text-slate-500">{center.data.person.birth ?? "s/f"}</span>
          </button>
        )}
        {rings.map((ring, ringIndex) => {
          const radius = 118 + ringIndex * 82;
          return ring.map((node, index) => {
            if (!node) return null;
            const angle = -160 + (320 / Math.max(1, ring.length - 1 || 1)) * index;
            const x = Math.cos((angle * Math.PI) / 180) * radius;
            const y = Math.sin((angle * Math.PI) / 180) * radius;
            return (
              <button
                key={`${ringIndex}-${index}-${node.id}`}
                type="button"
                onClick={() => onSelect(node.id)}
                className="absolute h-20 w-32 rounded-2xl border border-slate-200 p-2 text-left text-[11px] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                style={{
                  left: `calc(50% + ${x}px - 4rem)`,
                  top: `calc(50% + ${y}px - 2.5rem)`,
                  background: COLORS[(ringIndex + index) % COLORS.length],
                }}
              >
                <p className="line-clamp-2 font-semibold text-slate-950">{node.data.person.givenNames}</p>
                <p className="truncate text-slate-600">{node.data.person.surnames}</p>
                <p className="text-slate-500">{node.data.person.sourcesCount} fuentes</p>
              </button>
            );
          });
        })}
      </div>
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-white/90 px-4 py-2 text-xs text-slate-600 shadow-sm">
        <span>Colores: estado de investigación</span>
        <span>·</span>
        <span>{rings.length} generaciones visibles</span>
      </div>
    </div>
  );
}
