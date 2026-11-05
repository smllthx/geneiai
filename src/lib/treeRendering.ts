export interface FamilyBranch {
  id: string;
  side: number;
  rootSide: number;
  repeated: boolean;
  children: FamilyBranch[];
}

/** Follow recorded links. A shared ancestor appears in both branches, but their
 * relatives are expanded only once. Cycles never introduce another generation. */
export function familyLayers(center: string, generations: number, relatives: (id: string) => (string | null)[]) {
  const root: FamilyBranch = { id: center, side: 0, rootSide: 0, repeated: false, children: [] };
  const layers = [[root]];
  const predecessor = new Map<string, string | null>([[center, null]]);

  for (let depth = 1; depth <= generations; depth++) {
    const next: FamilyBranch[] = [];
    for (const node of layers[depth - 1]) {
      if (node.repeated) continue;
      relatives(node.id).forEach((id, side) => {
        if (!id) return;
        const repeated = predecessor.has(id);
        if (repeated) {
          for (let path: string | null = node.id; path; path = predecessor.get(path) ?? null) {
            if (path === id) return;
          }
        } else {
          predecessor.set(id, node.id);
        }
        const child = { id, side, rootSide: depth === 1 ? side : node.rootSide, repeated, children: [] };
        node.children.push(child);
        next.push(child);
      });
    }
    if (!next.length) break;
    layers.push(next);
  }
  return layers;
}
