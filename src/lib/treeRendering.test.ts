import { describe, expect, it } from 'vitest';
import { ancestorLayers } from './treeRendering';
import { padresDe, hijosDe, hermanosDe, conyugesDe, type RelRow } from './kinship';
import { buildGenealogyLayout } from '@/components/tree/genealogyLayout';

describe('large and cyclic trees', () => {
  it('bounds the all-generations setting without allocating exponentially', () => {
    const layers = ancestorLayers('root', 999, (id) => [`${id}F`, `${id}M`]);
    expect(layers.flat()).toHaveLength(127);
    expect(layers).toHaveLength(7);
  });
  it('stops cycles and empty branches while retaining repeated ancestors on independent paths', () => {
    expect(ancestorLayers('a', 999, (id) => id === 'a' ? ['b', null] : ['a', null])).toEqual([['a'], ['b', null]]);
    expect(ancestorLayers('a', 999, () => [])).toEqual([['a']]);
    const layers = ancestorLayers('a', 3, (id) => id === 'a' ? ['b', 'c'] : id === 'b' || id === 'c' ? ['shared', null] : []);
    expect(layers[2]).toEqual(['shared', null, 'shared', null]);
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
