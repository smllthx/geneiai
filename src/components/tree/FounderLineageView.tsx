import PersonPortrait from "@/components/PersonPortrait";
import type { GenealogyRelationship, TreeNode } from "./types";

type FounderLineageViewProps = {
  generations: number;
  nodes: TreeNode[];
  relationships: GenealogyRelationship[];
  centerId: string;
  onSelect: (id: string) => void;
};

export default function FounderLineageView({ nodes, relationships, centerId, onSelect, generations }: FounderLineageViewProps) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const line: TreeNode[] = [];
  let current = byId.get(centerId) ?? nodes[0];
  const preferredParent = new Map<string, string>();
  for (const rel of relationships) {
    if (rel.type !== "padre" && rel.type !== "madre") continue;
    if (!byId.has(rel.from)) continue;
    if (!preferredParent.has(rel.to) || rel.type === "padre") preferredParent.set(rel.to, rel.from);
  }
  const visited = new Set<string>();
  while (current && line.length <= generations && !visited.has(current.id)) {
    visited.add(current.id);
    line.push(current);
    current = byId.get(preferredParent.get(current.id) ?? "");
  }
  line.reverse();

  return (
    <div className="absolute inset-0 overflow-auto p-8">
      <div className="mx-auto grid max-w-4xl gap-4 lg:grid-cols-[1fr_280px]">
        <div className="glass-card p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Vista linaje principal</p>
          <h2 className="mt-1 text-2xl font-semibold text-foreground">Primer antepasado hacia persona central</h2>
          <div className="mt-6 space-y-3">
            {line.map((node, index) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelect(node.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card/40 p-3 text-left transition hover:bg-foreground/5"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  <PersonPortrait personId={node.data.person.id} src={node.data.person.avatarUrl} name={[node.data.person.givenNames, node.data.person.surnames].join(" ")} className="h-full w-full rounded-full" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{node.data.person.givenNames} {node.data.person.surnames}</span>
                  <span className="text-xs text-muted-foreground">Generación {index + 1} · {node.data.person.birth ?? "s/f"}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <aside className="glass-card p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground">Resumen</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="text-muted-foreground">Total de generaciones</dt><dd className="font-semibold text-foreground">{line.length}</dd></div>
            <div><dt className="text-muted-foreground">Primer antepasado visible</dt><dd className="font-semibold text-foreground">{line[0]?.data.person.surnames ?? "No registrado"}</dd></div>
            <div><dt className="text-muted-foreground">Investigación</dt><dd className="font-semibold text-foreground">Revisar fuentes y huecos</dd></div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
