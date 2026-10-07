import { expect, it } from 'vitest';
import { generateExternalSearches } from './external-searches';
import type { Tables } from '@/integrations/supabase/types';
const person = { nombres: 'María', apellidos: 'Aeschlimann', nac_fecha: '1900-01-01', defuncion_fecha: null } as Tables<'personas'>;
it('uses the same place-aware links from a person and the research form', () => {
  const searches = generateExternalSearches(person, 'Antofagasta, Chile');
  const fs = searches.find(s => s.plataforma === 'FamilySearch · Registros')!;
  expect(new URL(fs.url).searchParams.get('q.birthLikePlace')).toBe('Antofagasta, Chile');
  expect(searches.some(s => s.plataforma === 'FamilySearch · Catálogo')).toBe(true);
  expect(searches.some(s => s.plataforma === 'Ancestry')).toBe(true);
  const variant = searches.find(s => s.plataforma.includes('variante'))!;
  expect(new URL(variant.url).searchParams.get('q.birthLikePlace')).toBe('Antofagasta, Chile');
  expect(new URL(variant.url).searchParams.get('q.birthLikeDate.from')).toBe('1895');
});
