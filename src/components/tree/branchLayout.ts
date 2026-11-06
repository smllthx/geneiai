import type { FamilyBranch } from '@/lib/treeRendering';

export type BranchNode = {
  key: string; personId?: string; branch?: FamilyBranch; parentKey?: string;
  depth: number; side: number; missingFor?: string;
};
export type CardGeometry = { width: number; height: number; anchorX: number; top: number; bottom: number };
export type PositionedBranch = BranchNode & CardGeometry & { x: number; y: number };
export const DEFAULT_CARD: CardGeometry = { width: 140, height: 174, anchorX: 70, top: 0, bottom: 174 };

/** An occurrence, not a person ID, is the drawing identity: shared ancestors
 * keep both family connections without merging two branches on the canvas. */
export function branchNodes(root: FamilyBranch, prefix: string, missingParents = false): BranchNode[] {
  const nodes: BranchNode[] = [{ key: 'center', personId: root.id, branch: root, depth: 0, side: 0 }];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node.branch || node.branch.repeated) continue;
    const children = [...node.branch.children].sort((a, b) => a.side - b.side);
    const sides = missingParents && (i === 0 || children.length) ? [0, 1] : children.map(child => child.side);
    for (const side of sides) {
      const child = children.find(item => item.side === side);
      nodes.push({ key: `${prefix}${nodes.length}`, personId: child?.id, branch: child,
        parentKey: node.key, depth: node.depth + 1, side,
        missingFor: child ? undefined : node.personId });
    }
  }
  return nodes;
}

/** Reserve the actual footprint of each subtree, then centre each person
 * between their immediate relatives. Iterative passes also support long chains. */
export function layoutBranches(nodes: BranchNode[], sizes: ReadonlyMap<string, CardGeometry>, direction: -1 | 1) {
  const children = new Map<string, BranchNode[]>();
  const rowHeights = new Map<number, number>();
  const geometry = (node: BranchNode) => sizes.get(node.key) ?? DEFAULT_CARD;
  for (const node of nodes) {
    rowHeights.set(node.depth, Math.max(rowHeights.get(node.depth) ?? 0, geometry(node).height));
    if (node.parentKey) children.set(node.parentKey, [...(children.get(node.parentKey) ?? []), node]);
  }
  const spans = new Map<string, { left: number; right: number }>();
  const offsets = new Map<string, number>();
  const gap = 36, rowGap = 64;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i], size = geometry(node), relatives = children.get(node.key) ?? [];
    let cursor = 0;
    for (const child of relatives) {
      const span = spans.get(child.key)!;
      offsets.set(child.key, cursor + span.left);
      cursor += span.left + span.right + gap;
    }
    const centre = relatives.length ? (offsets.get(relatives[0].key)! + offsets.get(relatives[relatives.length - 1].key)!) / 2 : 0;
    for (const child of relatives) offsets.set(child.key, offsets.get(child.key)! - centre);
    spans.set(node.key, { left: Math.max(size.anchorX, centre), right: Math.max(size.width - size.anchorX, cursor - gap - centre) });
  }
  const rows = new Map([[0, 0]]);
  for (let depth = 1; depth < rowHeights.size; depth++) {
    rows.set(depth, rows.get(depth - 1)! + direction * (rowGap + rowHeights.get(direction < 0 ? depth : depth - 1)!));
  }
  const positions = new Map<string, PositionedBranch>();
  for (const node of nodes) {
    const x = node.parentKey ? positions.get(node.parentKey)!.x + offsets.get(node.key)! : 0;
    positions.set(node.key, { ...node, ...geometry(node), x, y: rows.get(node.depth)! });
  }
  return [...positions.values()];
}

export function branchConnector(parent: PositionedBranch, child: PositionedBranch, junctionY: number) {
  return `M ${parent.x} ${parent.y + parent.bottom} V ${junctionY} H ${child.x} V ${child.y + child.top}`;
}
