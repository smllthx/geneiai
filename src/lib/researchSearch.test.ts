import { describe, expect, it } from 'vitest';
import { buildResearchLinks, catalogUrl, criteriaFromParams, criteriaToParams } from './researchSearch';

describe('research criteria', () => {
  it('preserves criteria and the research tab in shared URLs', () => {
    const params = criteriaToParams({ givenName: 'María & José', surname: 'Ríos', place: 'Antofagasta, Chile', year: '1900', keywords: 'Registro civil', catalogField: 'title' }, 'catalogo', 'Antofagasta', new URLSearchParams('tab=hub'));
    expect(params.get('tab')).toBe('hub');
    expect(criteriaFromParams(new URLSearchParams(params.toString()))).toEqual({ givenName: 'María & José', surname: 'Ríos', place: 'Antofagasta, Chile', year: '1900', keywords: 'Registro civil', catalogField: 'title' });
  });
  it('carries names, birth place and year range to FamilySearch records', () => {
    const links = buildResearchLinks({ givenName: 'María & José', surname: 'Ríos', place: 'Antofagasta, Chile', year: '1900' }, 'registros');
    const url = new URL(links.find(l => l.id === 'fs-records')!.url);
    expect(url.searchParams.get('q.givenName')).toBe('María & José');
    expect(url.searchParams.get('q.birthLikePlace')).toBe('Antofagasta, Chile');
    expect(url.searchParams.get('q.birthLikeDate.from')).toBe('1895');
    expect(url.searchParams.get('q.birthLikeDate.to')).toBe('1905');
    expect(links.some(l => l.id === 'ancestry')).toBe(true);
    expect(links.some(l => l.id === 'myheritage')).toBe(true);
  });
  it('searches catalogs by place and chosen field without excluding unindexed material', () => {
    const url = new URL(catalogUrl({ place: 'Antofagasta, Chile', keywords: 'Registro civil', catalogField: 'title' }));
    expect(url.searchParams.get('query')).toBe('+place:"Antofagasta, Chile" +title:"Registro civil"');
    expect(url.searchParams.has('availability')).toBe(false);
    expect(buildResearchLinks({ place: 'Antofagasta' }, 'catalogo')[0].id).toBe('fs-catalog');
  });
  it('preserves spaces while editing multiword queries', () => {
    const params = criteriaToParams({ place: 'Santiago de ' }, 'catalogo', 'María ', new URLSearchParams());
    expect(params.get('lugar')).toBe('Santiago de ');
    expect(params.get('q')).toBe('María ');
  });
  it('never interpolates catalog operators from user input', () => {
    const url = new URL(catalogUrl({ place: 'Chile" +author:"otro' }));
    expect(url.searchParams.get('query')).toBe('+place:"Chile +author: otro"');
  });
  it('does not turn invalid years or empty criteria into invented filters', () => {
    expect(buildResearchLinks({}, 'registros')).toEqual([]);
    const url = new URL(buildResearchLinks({ surname: 'Vega', year: 'abc' }, 'registros')[0].url);
    expect(url.searchParams.has('q.birthLikeDate.from')).toBe(false);
  });
});
