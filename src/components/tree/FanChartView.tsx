import { useMemo } from "react";
import FanChart from "@/components/FanChart";
import type { TreeEdge, TreeNode } from "./types";

type FanChartViewProps = {
  nodes: TreeNode[];
  edges: TreeEdge[];
  centerId: string;
  onSelect: (id: string) => void;
};

export default function FanChartView({ nodes, edges, centerId, onSelect }: FanChartViewProps) {
  const personas = useMemo(() => nodes.map(({ data: { person: p } }) => ({
    id: p.id, nombres: p.givenNames, apellidos: p.surnames, foto_url: p.avatarUrl,
    nac_fecha: p.birth, defuncion_fecha: p.death, caption: `${p.sourcesCount} fuentes`,
  })), [nodes]);
  const rels = useMemo(() => edges.map(edge => ({
    id: edge.id, persona_id: edge.target, pariente_id: edge.source,
    tipo: edge.type === "hijo" ? "parent" : edge.type,
  })), [edges]);
  return <div data-tree-fit className="absolute left-1/2 top-1/2 w-max -translate-x-1/2 -translate-y-1/2">
    <FanChart personas={personas} rels={rels} centerId={centerId} generations={4} onSelect={onSelect} />
  </div>;
}
