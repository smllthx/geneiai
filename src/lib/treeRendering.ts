// Keep a single frame bounded even when imported settings request 999 levels.
export const MAX_RENDER_GENERATIONS = 6;
export function renderGenerations(value: number) {
  return Math.max(1, Math.min(MAX_RENDER_GENERATIONS, Number.isFinite(value) ? Math.floor(value) : 4));
}

export function ancestorLayers(center: string, generations: number, parents: (id: string) => (string | null)[]) {
  const layers: (string | null)[][] = [[center]];
  let paths: string[][] = [[center]];
  for (let g = 1; g <= renderGenerations(generations); g++) {
    const next: (string | null)[] = [];
    const nextPaths: string[][] = [];
    layers[g - 1].forEach((id, i) => {
      const pair = id ? parents(id) : [];
      for (let side = 0; side < 2; side++) {
        const parent = pair[side] ?? null;
        const valid = parent && !paths[i].includes(parent) ? parent : null;
        next.push(valid);
        nextPaths.push(valid ? [...paths[i], valid] : paths[i]);
      }
    });
    if (!next.some(Boolean)) break;
    layers.push(next);
    paths = nextPaths;
  }
  return layers;
}
