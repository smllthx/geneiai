import type { SupabaseClient } from "@supabase/supabase-js";
import PersonPortrait from "@/components/PersonPortrait";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, Loader2, Search } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPeople, getActiveTreeId } from "@/lib/peopleData";
import {
  filterPeopleForQuery,
  personFullName,
  personIndexLetter,
  personSearchSubtitle,
  type SearchablePerson,
} from "@/lib/personSearch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type UniversalPerson = SearchablePerson & {
  arbol_id?: string | null;
  foto_url?: string | null;
};

type Props = {
  compact?: boolean;
  className?: string;
};

export default function UniversalPersonSearch({ compact = false, className }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scope, setScope] = useState<"current" | "all">("current");
  const [trees, setTrees] = useState<Record<string, string>>({});
  const [visibleLimit, setVisibleLimit] = useState(60);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<UniversalPerson[]>([]);
  const [loading, setLoading] = useState(false);

  const activeLoad = useRef<AbortController>();
  const loadPeople = useCallback(async () => {
    activeLoad.current?.abort();
    const controller = new AbortController();
    activeLoad.current = controller;
    setLoading(true);
    setPeople([]);
    try {
      const treeId = await getActiveTreeId(user?.id);
      const { data: ownedTrees, error: treeError } = await (supabase as SupabaseClient).from("arboles").select("id,nombre").eq("user_id", user!.id).abortSignal(controller.signal);
      if (treeError) throw treeError;
      const data = await fetchAllPeople<UniversalPerson>(
        "id,nombres,apellidos,variantes_nombre,sexo,nac_fecha,nac_fecha_aprox,nac_rango_ini,nac_rango_fin,defuncion_fecha,nacionalidad,arbol_id,foto_url",
        { treeId: scope === "all" ? null : treeId, includeUnscoped: false, signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setTrees(Object.fromEntries((ownedTrees ?? []).map(tree => [tree.id, tree.nombre])));
      setPeople(scope === "current" && !treeId ? data.filter(p => !p.arbol_id) : data);
    } catch (error: any) {
      if (!controller.signal.aborted) toast.error(error?.message ?? "No pude cargar el índice de personas");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [scope, user?.id]);

  useEffect(() => {
    if (!open || !user) { setPeople([]); return; }
    void loadPeople();
    return () => activeLoad.current?.abort();
  }, [open, loadPeople, user?.id]);
  useEffect(() => { setVisibleLimit(60); }, [query, scope]);

  useEffect(() => {
    const refresh = (event: Event) => {
      const table = (event as CustomEvent).detail?.table;
      if (table && !["personas", "arboles", "profiles"].includes(table)) return;
      if (open) void loadPeople();
      else { activeLoad.current?.abort(); setPeople([]); }
    };
    window.addEventListener("genaia:data-changed", refresh);
    return () => { activeLoad.current?.abort(); window.removeEventListener("genaia:data-changed", refresh); };
  }, [open, loadPeople]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const results = useMemo(() => {
    return filterPeopleForQuery(people, query, { limit: Infinity });
  }, [people, query]);

  const grouped = useMemo(() => {
    if (query.trim()) return [["Resultados por relevancia", results.slice(0, visibleLimit)]] as [string, UniversalPerson[]][];
    const map = new Map<string, UniversalPerson[]>();
    for (const person of results.slice(0, visibleLimit)) {
      const letter = personIndexLetter(person);
      const current = map.get(letter) ?? [];
      current.push(person);
      map.set(letter, current);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true }));
  }, [results, query, visibleLimit]);

  const openPerson = (id: string) => {
    setOpen(false);
    navigate(`/personas/${id}`);
  };

  const investigatePerson = (person: UniversalPerson) => {
    setOpen(false);
    sessionStorage.setItem("geneai:ai-search-query", personFullName(person));
    navigate(`/investigacion?tab=busqueda&persona=${person.id}`);
  };

  const investigateQuery = () => {
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    sessionStorage.setItem("geneai:ai-search-query", q);
    navigate(`/investigacion?tab=busqueda&q=${encodeURIComponent(q)}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={compact ? "ghost" : "secondary"}
          size={compact ? "icon" : "sm"}
          className={cn("rounded-xl", !compact && "w-full justify-start gap-2", className)}
          aria-label="Abrir buscador universal de personas"
        >
          <Search className="h-4 w-4" />
          {!compact && <span>Buscar persona</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="app-dialog person-search-dialog p-0 sm:max-w-3xl" aria-describedby={undefined}>
        <DialogHeader className="border-b border-border/70 p-4 pb-3">
          <DialogTitle>Índice universal de personas</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Busca por nombre completo, variantes, código o fecha. Compara las fichas y su árbol antes de fusionarlas.
          </p>
        </DialogHeader>

        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-3"><label htmlFor="person-search-scope" className="text-sm font-medium">Buscar en</label>
            <select id="person-search-scope" value={scope} onChange={e => setScope(e.target.value as "current" | "all")} className="min-h-11 rounded-xl border bg-background/50 px-3 text-sm">
              <option value="current">Árbol actual</option><option value="all">Todos mis árboles</option>
            </select>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por apellido, nombre, código, año o lugar"
              className="h-12 pl-9 text-base"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{people.length} personas · {scope === "current" ? "Árbol actual" : "Todos mis árboles"}</Badge>
              <Badge variant="outline">{results.length} coincidencias</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={investigateQuery} disabled={!query.trim()}>
              <Brain className="h-4 w-4" /> IA internet
            </Button>
          </div>

          <div className="max-h-[50dvh] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card/70">
            {loading ? (
              <div className="grid min-h-44 place-items-center text-sm text-muted-foreground">
                <Loader2 className="mb-2 h-5 w-5 animate-spin" />
                Cargando índice…
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                No encontré personas con esos criterios.
              </div>
            ) : (
              grouped.map(([letter, group]) => (
                <section key={letter} className="border-b border-border/60 last:border-b-0">
                  <div className="sticky top-0 z-10 flex h-9 items-center gap-2 bg-background/90 px-3 text-sm font-bold text-primary backdrop-blur">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary/12 px-1">{query.trim() ? "↓" : letter}</span>{query.trim() && <span>{letter}</span>}
                    <span className="text-xs font-medium text-muted-foreground">{group.length} persona(s)</span>
                  </div>
                  <div className="divide-y divide-border/60">
                    {group.map((person) => (
                      <div key={person.id} className="flex items-center gap-3 px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => openPerson(person.id)}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-primary">
                            <PersonPortrait person={person} className="h-full w-full" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{personFullName(person)}</span>
                            <span className="block truncate text-xs text-muted-foreground">{personSearchSubtitle(person)}</span>
                            <span className="block truncate text-xs text-primary">{person.arbol_id ? trees[person.arbol_id] || "Árbol sin nombre" : "Sin árbol asignado"}</span>
                          </span>
                        </button>
                        <Button size="sm" variant="ghost" onClick={() => investigatePerson(person)}>
                          <Brain className="h-4 w-4" />
                          <span className="hidden sm:inline">IA</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
          {!loading && results.length > visibleLimit && <Button variant="outline" onClick={() => setVisibleLimit(n => n + 60)}>Mostrar más · {visibleLimit} de {results.length}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
