export function applyTreeScope<T extends { or: (filters: string) => T }>(
  query: T,
  treeId?: string | null,
  includeUnscoped = true,
) {
  if (!treeId) return query;
  return includeUnscoped
    ? query.or(`arbol_id.eq.${treeId},arbol_id.is.null`)
    : query.or(`arbol_id.eq.${treeId}`);
}
