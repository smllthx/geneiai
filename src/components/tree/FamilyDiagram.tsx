import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { FamilyBranch } from '@/lib/treeRendering';
import { branchConnector, branchNodes, layoutBranches, type CardGeometry } from './branchLayout';

type Props = {
  ancestors: FamilyBranch; descendants?: FamilyBranch; showMissing?: boolean;
  renderPerson: (id: string, kind: 'ancestor' | 'descendant' | 'center') => ReactNode;
  renderMissing?: (childId: string, side: number) => ReactNode;
};

export default function FamilyDiagram({ ancestors, descendants, showMissing = true, renderPerson, renderMissing }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState<Map<string, CardGeometry>>(new Map());
  const up = useMemo(() => branchNodes(ancestors, 'a', showMissing && !!renderMissing), [ancestors, showMissing, !!renderMissing]);
  const down = useMemo(() => descendants ? branchNodes(descendants, 'd') : [], [descendants]);
  const model = useMemo(() => [...up, ...down.slice(1)], [up, down]);

  useLayoutEffect(() => {
    const host = container.current;
    if (!host) return;
    const elements = [...host.querySelectorAll<HTMLElement>('[data-family-node]')];
    const measure = () => {
      const next = new Map<string, CardGeometry>();
      for (const element of elements) {
        const width = element.offsetWidth, height = element.offsetHeight;
        if (!width || !height) continue;
        const card = element.querySelector<HTMLElement>('[data-person-card]') ?? element.querySelector<HTMLElement>('button') ?? element;
        const rect = element.getBoundingClientRect(), cardRect = card.getBoundingClientRect();
        const scale = rect.width / width || 1;
        next.set(element.dataset.familyNode!, { width, height,
          anchorX: (cardRect.left - rect.left + cardRect.width / 2) / scale,
          top: (cardRect.top - rect.top) / scale, bottom: (cardRect.bottom - rect.top) / scale });
      }
      setSizes(previous => {
        if (previous.size === next.size && [...next].every(([key, value]) => {
          const old = previous.get(key);
          return old && Object.keys(value).every(field => Math.abs(old[field as keyof CardGeometry] - value[field as keyof CardGeometry]) < .5);
        })) return previous;
        return next;
      });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    elements.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [model, renderPerson, renderMissing]);

  const layout = useMemo(() => {
    const above = layoutBranches(up, sizes, -1), below = layoutBranches(down, sizes, 1);
    const nodes = [...above, ...below.slice(1)];
    const byKey = new Map(nodes.map(node => [node.key, node]));
    const rowBottoms = new Map<number, number>(), rowTops = new Map<number, number>();
    for (const node of nodes) {
      rowBottoms.set(node.y, Math.max(rowBottoms.get(node.y) ?? -Infinity, node.y + node.height));
      rowTops.set(node.y, Math.min(rowTops.get(node.y) ?? Infinity, node.y));
    }
    const edges = nodes.filter(node => node.parentKey).map(node => {
      const near = byKey.get(node.parentKey!)!;
      const [parent, child] = node.key.startsWith('a') ? [node, near] : [near, node];
      const junction = (rowBottoms.get(parent.y)! + rowTops.get(child.y)!) / 2;
      return { key: node.key, parent, child, path: branchConnector(parent, child, junction), missing: !!node.missingFor };
    });
    const minX = Math.min(...nodes.map(node => node.x - node.anchorX)) - 24;
    const maxX = Math.max(...nodes.map(node => node.x + node.width - node.anchorX)) + 24;
    const minY = Math.min(...nodes.map(node => node.y)) - 24;
    const maxY = Math.max(...nodes.map(node => node.y + node.height)) + 24;
    return { nodes, edges, minX, minY, width: maxX - minX, height: maxY - minY, center: byKey.get('center')! };
  }, [up, down, sizes]);

  return <div ref={container} data-tree-fit className="family-diagram relative shrink-0" style={{ width: layout.width, height: layout.height }}>
    <svg className="pointer-events-none absolute inset-0 overflow-visible" width={layout.width} height={layout.height} aria-hidden="true">
      <g transform={`translate(${-layout.minX} ${-layout.minY})`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-foreground/45">
        {layout.edges.map(edge => <path key={edge.key} data-family-link data-parent-id={edge.parent.personId} data-child-id={edge.child.personId}
          d={edge.path} strokeDasharray={edge.missing ? '4 5' : undefined} opacity={edge.missing ? .55 : 1} />)}
      </g>
    </svg>
    <span data-tree-focus className="pointer-events-none absolute h-px w-px" style={{ left: -layout.minX, top: -layout.minY + layout.center.top + (layout.center.bottom - layout.center.top) / 2 }} />
    {layout.nodes.map(node => <div key={node.key} data-family-node={node.key} data-person-id={node.personId}
      data-generation={node.key.startsWith('d') ? -node.depth : node.depth}
      className="absolute w-max" style={{ left: node.x - node.anchorX - layout.minX, top: node.y - layout.minY }}>
      {node.personId ? renderPerson(node.personId, node.key === 'center' ? 'center' : node.key.startsWith('a') ? 'ancestor' : 'descendant')
        : node.missingFor && renderMissing?.(node.missingFor, node.side)}
    </div>)}
  </div>;
}
