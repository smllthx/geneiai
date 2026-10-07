import { afterEach, expect, it, vi } from 'vitest';
import { savePersonPortrait } from './portraits';
const state = vi.hoisted(() => ({ person: { foto_url: '' }, photo: { personas_ids: ['other'] }, fail: false }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => {
  let patch: Record<string, unknown> | undefined;
  const builder = { select: () => builder, eq: () => builder, update: (value: Record<string, unknown>) => { patch = value; return builder; }, single: async () => {
    if (state.fail && table === 'personas') return { data: null, error: new Error('save failed') };
    const row = table === 'personas' ? state.person : state.photo;
    if (patch) Object.assign(row, patch);
    return { data: row, error: null };
  } };
  return builder;
} } }));
afterEach(() => { state.person.foto_url = ''; state.photo.personas_ids = ['other']; state.fail = false; });
it('saves the chosen portrait and retains the other people linked to its photo', async () => {
  await savePersonPortrait('person1', 'https://example.com/photo.jpg', 'photo1');
  expect(state.person.foto_url).toBe('https://example.com/photo.jpg');
  expect(state.photo.personas_ids).toEqual(['other', 'person1']);
});
it('notifies visible views only after a successful save', async () => {
  const listener = vi.fn(); window.addEventListener('genaia:data-changed', listener);
  try {
    state.fail = true;
    await expect(savePersonPortrait('person1', 'https://example.com/photo.jpg')).rejects.toThrow('save failed');
    expect(listener).not.toHaveBeenCalled();
    state.fail = false;
    await savePersonPortrait('person1', 'https://example.com/photo.jpg');
    expect(listener).toHaveBeenCalledTimes(1);
  } finally { window.removeEventListener('genaia:data-changed', listener); }
});
