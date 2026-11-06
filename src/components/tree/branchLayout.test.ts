import { describe, expect, it } from 'vitest';
import { familyLayers } from '@/lib/treeRendering';
import { branchConnector, branchNodes, DEFAULT_CARD, layoutBranches, type CardGeometry } from './branchLayout';

const graph: Record<string, (string | null)[]> = {
  child: ['father', 'mother'], father: ['grandfather', 'grandmother'],
  mother: [null, 'maternal'], grandfather: ['great1', 'great2'], great1: ['older'],
};
const tree = (id = 'child') => familyLayers(id, Infinity, id => graph[id] ?? [])[0][0];
const drawing = () => layoutBranches(branchNodes(tree(), 'a', true), new Map(), -1);

describe('connected family layout', () => {
  it('aligns every generation despite unequal depths and a missing paternal slot', () => {
    const nodes = drawing();
    for (const depth of new Set(nodes.map(node => node.depth))) {
      expect(new Set(nodes.filter(node => node.depth === depth).map(node => node.y)).size).toBe(1);
    }
    const mother = nodes.find(node => node.personId === 'mother')!;
    const maternal = nodes.find(node => node.personId === 'maternal')!;
    const missing = nodes.find(node => node.missingFor === 'mother')!;
    expect(missing.x).toBeLessThan(mother.x);
    expect(maternal.x).toBeGreaterThan(mother.x);
    expect(mother.x).toBe((missing.x + maternal.x) / 2);
  });

  it('centres a person between their own parents, not the unrelated row edges', () => {
    const nodes = drawing();
    for (const child of nodes) {
      const parents = nodes.filter(node => node.parentKey === child.key);
      if (parents.length) expect(child.x).toBe((parents[0].x + parents[parents.length - 1].x) / 2);
    }
  });

  it('does not overlap cards or spouse groups with different measured sizes', () => {
    const model = branchNodes(tree(), 'a', true);
    const sizes = new Map<string, CardGeometry>(model.map((node, i) => [node.key, {
      width: 140 + (i % 3) * 180, height: 160 + (i % 4) * 40, anchorX: 70, top: 8, bottom: 152 + (i % 4) * 40,
    }]));
    const nodes = layoutBranches(model, sizes, -1);
    for (const a of nodes) for (const b of nodes) {
      if (a.key === b.key) continue;
      const overlapsX = a.x - a.anchorX < b.x - b.anchorX + b.width && a.x - a.anchorX + a.width > b.x - b.anchorX;
      const overlapsY = a.y < b.y + b.height && a.y + a.height > b.y;
      expect(overlapsX && overlapsY).toBe(false);
    }
  });

  it('connects the actual parent bottom and child top, including a wide spouse strip', () => {
    const model = branchNodes(tree(), 'a');
    const sizes = new Map([['center', { width: 640, height: 204, anchorX: 82, top: 4, bottom: 176 }]]);
    const nodes = layoutBranches(model, sizes, -1);
    const child = nodes[0], father = nodes.find(node => node.personId === 'father')!;
    expect(child.x).toBe(0);
    const path = branchConnector(father, child, -32);
    expect(path.startsWith(`M ${father.x} ${father.y + DEFAULT_CARD.bottom}`)).toBe(true);
    expect(path.endsWith('H 0 V 4')).toBe(true);
  });

  it('retains both links to a repeated ancestor, stops a cycle and avoids recursive rendering', () => {
    const relatives: Record<string, string[]> = { a: ['b', 'c'], b: ['shared'], c: ['shared'], shared: ['a', 'known'] };
    const root = familyLayers('a', Infinity, id => relatives[id] ?? [])[0][0];
    const nodes = layoutBranches(branchNodes(root, 'a'), new Map(), -1);
    const shared = nodes.filter(node => node.personId === 'shared');
    expect(shared).toHaveLength(2);
    expect(new Set(shared.map(node => node.key)).size).toBe(2);
    expect(shared[0].x).not.toBe(shared[1].x);
    expect(nodes.filter(node => node.personId === 'a')).toHaveLength(1);
    const deep = familyLayers('0', Infinity, id => Number(id) < 1200 ? [String(Number(id) + 1)] : [])[0][0];
    const long = layoutBranches(branchNodes(deep, 'a'), new Map(), -1);
    expect(long).toHaveLength(1201);
    expect(long.every(node => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true);
  });

  it('keeps descendants below the central person with their own family links', () => {
    const root = familyLayers('parent', Infinity, id => ({ parent: ['first', 'second'], first: ['grandchild'] }[id] ?? []))[0][0];
    const nodes = layoutBranches(branchNodes(root, 'd'), new Map(), 1);
    expect(nodes.find(node => node.personId === 'grandchild')!.x).toBe(nodes.find(node => node.personId === 'first')!.x);
    for (const node of nodes.slice(1)) {
      const parent = nodes.find(other => other.key === node.parentKey)!;
      expect(node.y).toBeGreaterThan(parent.y + parent.height);
    }
  });
});
