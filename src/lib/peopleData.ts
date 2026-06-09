import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 1000;

export async function getActiveTreeId(userId?: string | null) {
  let uid = userId ?? null;
  if (!uid) uid = (await supabase.auth.getUser()).data.user?.id ?? null;
  if (!uid) return null;
  const { data } = await supabase
    .from("profiles")
    .select("active_arbol_id")
    .eq("id", uid)
    .maybeSingle();
  return ((data as any)?.active_arbol_id ?? null) as string | null;
}

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

export async function fetchAllPeople<T = any>(
  select = "*",
  options: { treeId?: string | null; includeUnscoped?: boolean } = {},
) {
  const treeId = options.treeId === undefined ? await getActiveTreeId() : options.treeId;
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const query = supabase
      .from("personas")
      .select(select)
      .order("apellidos", { ascending: true })
      .order("nombres", { ascending: true })
      .range(from, to);
    const { data, error } = await applyTreeScope(query as any, treeId, options.includeUnscoped ?? true);
    if (error) throw error;
    const page = (data ?? []) as T[];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
}

export async function fetchAllRelations<T = any>(
  select = "*",
  options: { treeId?: string | null; includeUnscoped?: boolean } = {},
) {
  const treeId = options.treeId === undefined ? await getActiveTreeId() : options.treeId;
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const query = supabase
      .from("relaciones")
      .select(select)
      .range(from, to);
    const { data, error } = await applyTreeScope(query as any, treeId, options.includeUnscoped ?? true);
    if (error) throw error;
    const page = (data ?? []) as T[];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
}

export function withTreeScope<T extends Record<string, any>>(row: T, treeId?: string | null): T {
  return treeId ? ({ ...row, arbol_id: treeId } as T) : row;
}

export async function getActiveTreeScopedIds() {
  const treeId = await getActiveTreeId();
  const personas = await fetchAllPeople<{ id: string }>("id", { treeId });
  return { treeId, personIds: new Set(personas.map((p) => p.id)) };
}
