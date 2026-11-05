import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeReload } from "@/hooks/use-realtime-reload";
import { fetchAllPeople, fetchAllRelations, getActiveTreeId } from "@/lib/peopleData";
import type { Tables } from "@/integrations/supabase/types";
import type { RelRow } from "@/lib/kinship";
import { construirCaminoParentesco } from "@/lib/parentesco";
import { checkCoherence } from "@/lib/coherence";
import { personFullName } from "@/lib/personSearch";
import PersonSearchSelect from "@/components/PersonSearchSelect";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import SectionPlaceholder from "@/components/SectionPlaceholder";

type Person = Pick<Tables<"personas">, "id" | "nombres" | "apellidos" | "sexo" | "nac_fecha" | "nac_fecha_aprox" | "nac_rango_ini" | "nac_rango_fin" | "defuncion_fecha" | "foto_url">;
const personFields = "id,nombres,apellidos,sexo,nac_fecha,nac_fecha_aprox,nac_rango_ini,nac_rango_fin,defuncion_fecha,foto_url";

function Consistency({ people, relations }: { people: Person[]; relations: RelRow[] }) {
  const issues = useMemo(() => checkCoherence(people, relations), [people, relations]);
  const byId = useMemo(() => new Map(people.map(person => [person.id, personFullName(person)])), [people]);
  return <section aria-label="Resultados de la revisión">
    <p role="status" className="mb-3">{issues.length ? `${issues.length} observaciones para revisar.` : "No se encontraron incoherencias en los datos registrados."}</p>
    <ul className="divide-y rounded-xl border">{issues.map(issue => <li key={issue.id} className="p-3">
      <Link to={`/personas/${issue.persona_id}`} className="font-semibold text-primary underline">{byId.get(issue.persona_id)}</Link>
      <p>{issue.message}</p>
      {issue.related_id && byId.has(issue.related_id) && <Link to={`/personas/${issue.related_id}`} className="text-sm text-primary underline">{byId.get(issue.related_id)}</Link>}
    </li>)}</ul>
  </section>;
}

function RelationshipReport({ people, relations }: { people: Person[]; relations: RelRow[] }) {
  const [params, setParams] = useSearchParams();
  const firstId = params.get("persona") ?? "";
  const setFirstId = (id: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set("persona", id); else next.delete("persona");
    setParams(next, { replace: true });
  };
  const [secondId, setSecondId] = useState("");
  const byId = useMemo(() => new Map(people.map(person => [person.id, person])), [people]);
  const first = byId.get(firstId), second = byId.get(secondId);
  const path = useMemo(() => first && second ? construirCaminoParentesco(first.id, second.id, relations) : [], [first, second, relations]);
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <fieldset><legend className="mb-2 font-semibold">Primera persona</legend>
        <PersonSearchSelect people={people} value={first} excludeId={secondId} onChange={person => setFirstId(person?.id ?? "")} placeholder="Buscar primera persona" />
      </fieldset>
      <fieldset><legend className="mb-2 font-semibold">Segunda persona</legend>
        <PersonSearchSelect people={people} value={second} excludeId={firstId} onChange={person => setSecondId(person?.id ?? "")} placeholder="Buscar segunda persona" />
      </fieldset>
    </div>
    {first && second && <section className="space-y-2 rounded-2xl border bg-card p-4" aria-label="Camino de parentesco">
      <h2 className="text-lg font-semibold">Camino de parentesco</h2>
      {path.length ? <ol className="list-inside list-decimal space-y-2">{path.map((id, index) => {
        const person = byId.get(id);
        if (!person) return null;
        const previous = path[index - 1];
        const edge = previous && relations.find(row => row.persona_id === previous && row.pariente_id === id || row.persona_id === id && row.pariente_id === previous);
        const label = edge && (edge.persona_id === previous ? edge.tipo : ({ padre: "hijo/a", madre: "hijo/a", hijo: "padre/madre" } as Record<string, string>)[edge.tipo] || edge.tipo);
        return <li key={id}><Link to={`/personas/${id}`} className="font-semibold text-primary underline">{personFullName(person)}</Link>
          {label && <span className="ml-2 text-sm text-muted-foreground">{label === "conyuge" ? "cónyuge" : label} de {personFullName(byId.get(previous)!)}</span>}
        </li>;
      })}</ol> : <p>No se encontró un vínculo registrado entre estas dos personas.</p>}
    </section>}
  </div>;
}

export default function TreeReports({ mode }: { mode: "coherence" | "relationships" }) {
  const { user } = useAuth();
  const revision = useRealtimeReload(["personas", "relaciones", "arboles"], user?.id);
  const archive = useQuery({
    queryKey: ["tree-reports", user?.id, revision], enabled: !!user,
    queryFn: async ({ signal }) => {
      const treeId = await getActiveTreeId(user!.id);
      const [people, relations] = await Promise.all([
        fetchAllPeople<Person>(personFields, { treeId, signal }),
        fetchAllRelations<RelRow>("id,persona_id,pariente_id,tipo", { treeId, signal }),
      ]);
      const ids = new Set(people.map(p => p.id));
      return { people, relations: relations.filter(r => ids.has(r.persona_id) && ids.has(r.pariente_id)) };
    },
  });
  const check = mode === "coherence";
  return <>
    <PageHeader title={check ? "Consistency Checker" : "Informe de relaciones"} subtitle={check ? "Revisa fechas y vínculos del árbol. Abre la ficha indicada para comprobar cada observación." : "Elige dos personas para ver la cadena de vínculos familiares que las une."} />
    {archive.isPending ? <SectionPlaceholder /> : archive.isError ? <div role="alert">No se pudo consultar el árbol. <Button onClick={() => archive.refetch()}>Reintentar</Button></div> :
      !archive.data.people.length ? <p>Tu árbol aún no tiene personas. <Link className="text-primary underline" to="/personas/nueva">Agregar una persona</Link></p> :
      check ? <Consistency {...archive.data} /> : <RelationshipReport {...archive.data} />}
  </>;
}
