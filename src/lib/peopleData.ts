import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 1000;

export async function fetchAllPeople<T = any>(select = "*") {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("personas")
      .select(select)
      .order("apellidos", { ascending: true })
      .order("nombres", { ascending: true })
      .range(from, to);
    if (error) throw error;
    const page = (data ?? []) as T[];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
}

