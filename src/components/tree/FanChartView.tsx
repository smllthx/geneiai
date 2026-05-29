import type { TreeEdge, TreeNode } from "./types";

type FanChartViewProps = {
  nodes: TreeNode[];
  edges: TreeEdge[];
  centerId: string;
  onSelect: (id: string) => void;
};

const COLORS = ["#dbeafe", "#dcfce7", "#f5d0fe", "#fef3c7", "#e0e7ff", "#fee2e2"];

export default function FanChartView({ nodes, centerId, onSelect }: FanChartViewProps) {
  const center = nodes.find((node) => node.id === centerId) ?? nodes[0];
  const others = nodes.filter((node) => node.id !== center?.id).slice(0, 28);
  const rings = [others.slice(0, 2), others.slice(2, 6), others.slice(6, 14), others.slice(14, 28)];

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
            const angle = -160 + (320 / Math.max(1, ring.length - 1 || 1)) * index;
            const x = Math.cos((angle * Math.PI) / 180) * radius;
            const y = Math.sin((angle * Math.PI) / 180) * radius;
            return (
              <button
                key={node.id}
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
        <span>4 generaciones visibles</span>
      </div>
    </div>
  );
}
