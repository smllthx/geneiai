import { familyLayers } from "@/lib/treeRendering";
import { indexFamilyLinks } from "./genealogyLayout";
import PersonPortrait from "@/components/PersonPortrait";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GenealogyRelationship, TreeNode } from "./types";

type DescendancyViewProps = {
  generations: number;
  nodes: TreeNode[];
  relationships: GenealogyRelationship[];
  centerId: string;
  onSelect: (id: string) => void;
  onAddChild: (id: string) => void;
};

export default function DescendancyView({ nodes, relationships, centerId, generations, onSelect, onAddChild }: DescendancyViewProps) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const center = byId.get(centerId) ?? nodes[0];
  const links = indexFamilyLinks(relationships).children;
  const layers = familyLayers(centerId, generations, id => (links.get(id) ?? []).filter(child => byId.has(child))).slice(1);

  return (
    <div className="absolute inset-0 overflow-auto p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="glass-card p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Vista descendente</p>
          <button type="button" onClick={() => center && onSelect(center.id)} className="mt-2 flex items-center gap-3 text-left text-2xl font-semibold text-foreground">
            {center && <PersonPortrait personId={center.data.person.id} src={center.data.person.avatarUrl} name={[center.data.person.givenNames, center.data.person.surnames].join(" ")} className="h-12 w-12 shrink-0 rounded-full" />}
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
            {layers.length === 0 && <p className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">Aún no hay hijos registrados para esta persona.</p>}
            {layers.map((layer, depth) => <section className="space-y-2" key={depth}>
              <h3 className="text-xs font-semibold text-muted-foreground">Generación {depth + 1}</h3>
              {layer.filter(node => !node.repeated).map(node => byId.get(node.id)!).map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => onSelect(child.id)}
                className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-card/40 p-3 text-left transition hover:bg-foreground/5"
              >
                <PersonPortrait personId={child.data.person.id} src={child.data.person.avatarUrl} name={[child.data.person.givenNames, child.data.person.surnames].join(" ")} className="mr-3 h-10 w-10 shrink-0 rounded-full" />
                <span className="flex-1">
                  <span className="block font-medium text-foreground">{child.data.person.givenNames} {child.data.person.surnames}</span>
                  <span className="text-xs text-muted-foreground">{child.data.person.birth ?? "s/f"} · {child.data.person.mainPlace ?? "Lugar no registrado"}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}</section>)}
          </div>
        </div>
      </div>
    </div>
  );
}
