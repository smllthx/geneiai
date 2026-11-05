import { describe, expect, it } from 'vitest';
import { familyLayers } from './treeRendering';
import { padresDe, hijosDe, hermanosDe, conyugesDe, type RelRow } from './kinship';
import { buildGenealogyLayout } from '@/components/tree/genealogyLayout';

describe('large and cyclic trees', () => {
  it('walks any requested depth, including all known generations, without allocating missing people', () => {
    const parent = (id: string) => Number(id) < 1200 ? [null, String(Number(id) + 1)] : [];
    expect(familyLayers('0', 13, parent)).toHaveLength(14);
    const layers = familyLayers('0', Infinity, parent);
    expect(layers).toHaveLength(1201);
    expect(layers.flat()).toHaveLength(1201);
    expect(layers[1200][0].id).toBe('1200');
  });
  it('stops cycles and retains shared ancestors without expanding their lineage twice', () => {
    const relatives: Record<string, string[]> = { a: ['b', 'c'], b: ['shared'], c: ['shared'], shared: ['a', 'known'] };
    const layers = familyLayers('a', Infinity, id => relatives[id] ?? []);
    expect(layers.map(row => row.map(node => node.id))).toEqual([['a'], ['b','c'], ['shared','shared'], ['known']]);
    expect(layers[2].map(node => node.repeated)).toEqual([false, true]);
    expect(layers[2].map(node => node.rootSide)).toEqual([0, 1]);
  });
  it('handles dense pedigree collapse in proportion to the recorded links', () => {
    const parents = (id: string) => {
      const depth = Number(id.split('-')[0]);
      return depth < 100 ? [`${depth+1}-father`, `${depth+1}-mother`] : [];
    };
    const layers = familyLayers('0-root', Infinity, parents);
    expect(layers).toHaveLength(101);
    expect(layers.flat().length).toBeLessThan(401);
  });
  it('includes distant recorded ancestors and descendants in the modern layout', () => {
    const people = Array.from({ length: 401 }, (_, i) => ({ id: String(i), givenNames: 'Fixture', surnames: String(i), sourcesCount: 0, incomplete: true, researchStatus: 'pendiente' as const, lineage: 'central' as const, initials: 'F' }));
    const rels = people.slice(1).map((person, index) => ({ id: person.id, from: person.id, to: String(index), type: 'madre' as const }));
    expect(buildGenealogyLayout(people, rels, '200', 10).nodes).toHaveLength(21);
    const { nodes, edges } = buildGenealogyLayout(people, rels, '200', Infinity);
    expect(nodes).toHaveLength(401);
    expect(edges).toHaveLength(400);
  });
  it('indexes once and preserves direct, inverse and inferred kinship', () => {
    const people = ['child', 'sibling', 'father', 'mother'].map((id) => ({ id, nombres: id, apellidos: 'Fixture', sexo: id === 'mother' ? 'femenino' : 'masculino' }));
    const byId = new Map(people.map((p) => [p.id, p]));
    let accesses = 0;
    const rows: RelRow[] = Array.from({ length: 7000 }, (_, i) => ({ id: `unrelated${i}`, get persona_id() { accesses++; return `other${i}`; }, pariente_id: `other${i+1}`, tipo: 'padre' }));
    rows.push({ id: '1', persona_id: 'father', pariente_id: 'child', tipo: 'hijo' }, { id: '2', persona_id: 'sibling', pariente_id: 'father', tipo: 'padre' }, { id: '3', persona_id: 'father', pariente_id: 'mother', tipo: 'conyuge' });
    expect(padresDe('child', rows, byId).all.map((p) => p.id).sort()).toEqual(['father', 'mother']);
    accesses = 0;
    for (let i = 0; i < 100; i++) padresDe('child', rows, byId);
    expect(accesses).toBe(0);
    expect(hijosDe('father', rows, byId).map((p) => p.id).sort()).toEqual(['child', 'sibling']);
    expect(hermanosDe('child', rows, byId).map((p) => p.id)).toEqual(['sibling']);
    expect(conyugesDe('father', rows, byId).map((p) => p.id)).toContain('mother');
  });
  it('never stacks thousands of unrelated modern-tree cards at the center', () => {
    const people = Array.from({ length: 4077 }, (_, i) => ({ id: String(i), givenNames: 'Fixture', surnames: String(i), sourcesCount: 0, incomplete: true, researchStatus: 'pendiente' as const, lineage: 'central' as const, initials: 'F' }));
    const rels = [{ id: 'father', from: '1', to: '0', type: 'padre' as const }, { id: 'cycle', from: '0', to: '1', type: 'padre' as const }];
    const layout = buildGenealogyLayout(people, rels, '0');
    expect(layout.nodes.map((n) => n.id).sort()).toEqual(['0', '1']);
    expect(layout.edges).toHaveLength(2);
  });
});
