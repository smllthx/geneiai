export async function collectRows<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, pageSize = 500): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await read(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...data || []);
    if (!data || data.length < pageSize) return rows;
  }
}
