import { useMemo, useState } from "react";
import { Search, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  comparePeopleAlphabetically,
  filterPeopleForQuery,
  personFullName,
  personIndexLetter,
  personSearchSubtitle,
  type SearchablePerson,
} from "@/lib/personSearch";
import { cn } from "@/lib/utils";

type Props<T extends SearchablePerson> = {
  people: T[];
  value?: T | null;
  onChange: (person: T | null) => void;
  excludeId?: string | null;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  limit?: number;
};

export default function PersonSearchSelect<T extends SearchablePerson>({
  people,
  value,
  onChange,
  excludeId,
  placeholder = "Buscar persona por nombre, apellido o código",
  emptyText = "No encontré personas con esos datos.",
  className,
  limit = 40,
}: Props<T>) {
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => filterPeopleForQuery(people, query, { excludeId, limit }).slice().sort(comparePeopleAlphabetically),
    [people, query, excludeId, limit],
  );
  const groupedResults = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const person of results) {
      const letter = personIndexLetter(person);
      const current = map.get(letter) ?? [];
      current.push(person);
      map.set(letter, current);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true }));
  }, [results]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>

      {value && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{personFullName(value)}</p>
            <p className="truncate text-xs text-muted-foreground">{personSearchSubtitle(value)}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
            Cambiar
          </Button>
        </div>
      )}

      {!value && (
        <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-card/70">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            groupedResults.map(([letter, group]) => (
              <section key={letter} className="border-b border-border/60 last:border-b-0">
                <div className="sticky top-0 z-10 flex h-8 items-center gap-2 bg-background/90 px-3 text-xs font-bold text-primary backdrop-blur">
                  <span className="grid h-5 w-5 place-items-center rounded-md bg-primary/12">{letter}</span>
                  <span className="font-medium text-muted-foreground">{group.length}</span>
                </div>
                {group.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => onChange(person)}
                    className="flex w-full items-center gap-3 border-t border-border/60 px-3 py-2 text-left first:border-t-0 hover:bg-foreground/5 focus-visible:bg-foreground/5 focus-visible:outline-none"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <UserRound className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{personFullName(person)}</span>
                      <span className="block truncate text-xs text-muted-foreground">{personSearchSubtitle(person)}</span>
                    </span>
                  </button>
                ))}
              </section>
            ))
          )}
        </div>
      )}
    </div>
  );
}
