import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, Loader2, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { fetchAllPeople } from "@/lib/peopleData";
import {
  comparePeopleAlphabetically,
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<UniversalPerson[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPeople = async () => {
    setLoading(true);
    try {
      const data = await fetchAllPeople<UniversalPerson>(
        "id,nombres,apellidos,variantes_nombre,sexo,nac_fecha,nac_fecha_aprox,nac_rango_ini,nac_rango_fin,defuncion_fecha,defuncion_fecha_aprox,def_rango_ini,def_rango_fin,nacionalidad,arbol_id,foto_url",
        { treeId: null },
      );
      setPeople(data.slice().sort(comparePeopleAlphabetically));
    } catch (error: any) {
      toast.error(error?.message ?? "No pude cargar el índice de personas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || people.length) return;
    loadPeople();
  }, [open]);

  useEffect(() => {
    const refresh = () => {
      if (open) loadPeople();
    };
    window.addEventListener("genaia:data-changed", refresh);
    return () => window.removeEventListener("genaia:data-changed", refresh);
  }, [open]);

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
    const limit = query.trim() ? 160 : 700;
    return filterPeopleForQuery(people, query, { limit }).slice().sort(comparePeopleAlphabetically);
  }, [people, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, UniversalPerson[]>();
    for (const person of results) {
      const letter = personIndexLetter(person);
      const current = map.get(letter) ?? [];
      current.push(person);
      map.set(letter, current);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true }));
  }, [results]);

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
      <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border/70 p-4 pb-3">
          <DialogTitle>Índice universal de personas</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Busca por nombre, apellido, código, fechas o variantes. Incluye personas del árbol, importadas y no vinculadas.
          </p>
        </DialogHeader>

        <div className="space-y-3 p-4">
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
              <Badge variant="secondary">{people.length} personas cargadas</Badge>
              <Badge variant="outline">{results.length} coincidencias</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={investigateQuery} disabled={!query.trim()}>
              <Brain className="h-4 w-4" /> IA internet
            </Button>
          </div>

          <div className="max-h-[58vh] overflow-y-auto rounded-2xl border border-border bg-card/70">
            {loading ? (
              <div className="grid min-h-44 place-items-center text-sm text-muted-foreground">
                <Loader2 className="mb-2 h-5 w-5 animate-spin" />
                Cargando índice…
              </div>
            ) : grouped.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                No encontré personas con esos criterios.
              </div>
            ) : (
              grouped.map(([letter, group]) => (
                <section key={letter} className="border-b border-border/60 last:border-b-0">
                  <div className="sticky top-0 z-10 flex h-9 items-center gap-2 bg-background/90 px-3 text-sm font-bold text-primary backdrop-blur">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary/12">{letter}</span>
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
                            {person.foto_url ? (
                              <img src={person.foto_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <UserRound className="h-5 w-5" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{personFullName(person)}</span>
                            <span className="block truncate text-xs text-muted-foreground">{personSearchSubtitle(person)}</span>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
