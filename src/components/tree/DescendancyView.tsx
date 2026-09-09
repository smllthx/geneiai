import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GenealogyRelationship, TreeNode } from "./types";

type DescendancyViewProps = {
  nodes: TreeNode[];
  relationships: GenealogyRelationship[];
  centerId: string;
  onSelect: (id: string) => void;
  onAddChild: (id: string) => void;
};

export default function DescendancyView({ nodes, relationships, centerId, onSelect, onAddChild }: DescendancyViewProps) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const center = byId.get(centerId) ?? nodes[0];
  const children = relationships
    .filter((rel) => (rel.from === center?.id && rel.type === "hijo") || (rel.to !== center?.id && rel.from === center?.id && (rel.type === "padre" || rel.type === "madre")))
    .map((rel) => byId.get(rel.to))
    .filter((node, index, rows) => node && rows.findIndex((other) => other?.id === node.id) === index) as TreeNode[];

  return (
    <div className="absolute inset-0 overflow-auto p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="glass-card p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Vista descendente</p>
          <button type="button" onClick={() => center && onSelect(center.id)} className="mt-2 text-left text-2xl font-semibold text-foreground">
            {center?.data.person.givenNames} {center?.data.person.surnames}
          </button>
          <p className="text-sm text-slate-500">Persona principal, cónyuges, hijos y descendencia expandible.</p>
        </div>

        <div className="glass-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Hijos y descendientes</h2>
            {center && (
              <Button size="sm" onClick={() => onAddChild(center.id)}>
                <Plus className="h-4 w-4" /> Agregar hijo
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {children.length === 0 && <p className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">Aún no hay hijos registrados para esta persona.</p>}
            {children.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => onSelect(child.id)}
                className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-card/40 p-3 text-left transition hover:bg-foreground/5"
              >
                <span>
                  <span className="block font-medium text-foreground">{child.data.person.givenNames} {child.data.person.surnames}</span>
                  <span className="text-xs text-muted-foreground">{child.data.person.birth ?? "s/f"} · {child.data.person.mainPlace ?? "Lugar no registrado"}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
