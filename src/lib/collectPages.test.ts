import { expect, it } from 'vitest';
import { collectPages } from './collectPages';
it('includes records past the first page without duplicates or gaps', async () => {
  const rows = Array.from({ length: 2003 }, (_, id) => ({ id }));
  const result = await collectPages(async (from, to) => ({ data: rows.slice(from, to + 1), error: null }));
  expect(result).toEqual(rows);
});
it('does not present partial data as a complete archive when a later page fails', async () => {
  const failure = new Error('offline');
  await expect(collectPages(async (from) => from === 0 ? { data: Array.from({ length: 1000 }, (_, id) => ({ id })), error: null } : { data: null, error: failure })).rejects.toThrow('offline');
});
