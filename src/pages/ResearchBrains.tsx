import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { fetchAllPeople, fetchAllRelations, getActiveTreeId } from '@/lib/peopleData';
import { padresDe, hijosDe, conyugesDe, hermanosDe, type RelRow } from '@/lib/kinship';
import { checkCoherence } from '@/lib/coherence';
import GenealogistaIA from '@/components/GenealogistaIA';
import TreeInsights from '@/components/TreeInsights';
import PersonaSmartInsights from '@/components/PersonaSmartInsights';
import SectionPlaceholder from '@/components/SectionPlaceholder';
import { Button } from '@/components/ui/button';
import { useRealtimeReload } from '@/hooks/use-realtime-reload';
import { buildAssistantContext } from '@/lib/researchContext';

export default function ResearchBrains() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [issues, setIssues] = useState<ReturnType<typeof checkCoherence> | null>(null);
  const revision = useRealtimeReload(['personas', 'relaciones', 'eventos', 'arboles'], user?.id);
  const archive = useQuery({
    queryKey: ['research-brains', user?.id, revision], enabled: !!user, staleTime: 30000,
    queryFn: async () => {
      const treeId = await getActiveTreeId(user!.id);
      const [people, relations] = await Promise.all([fetchAllPeople<Tables<'personas'>>('*', { treeId }), fetchAllRelations<RelRow>('*', { treeId })]);
      return { people, relations, treeId };
    },
  });
  const people = archive.data?.people ?? [];
  const relations = archive.data?.relations ?? [];
  const person = people.find(p => p.id === params.get('persona')) ?? people[0];
  const events = useQuery({ queryKey: ['research-brain-events', user?.id, person?.id, revision], enabled: !!user && !!person,
    queryFn: async () => { const { data, error } = await supabase.from('eventos').select('*').eq('persona_id', person!.id); if (error) throw error; return data ?? []; },
  });
  if (archive.isPending) return <SectionPlaceholder />;
  if (archive.error) return <div role="alert">No se pudo cargar el contexto de investigación. <Button onClick={() => archive.refetch()}>Reintentar</Button></div>;
  if (!person) return <p>Agrega una persona para analizar su historia y su árbol.</p>;
  const byId = new Map(people.map(p => [p.id, p]));
  const parents = padresDe(person.id, relations, byId);
  const fam = { padres: parents.all, hijos: hijosDe(person.id, relations, byId), conyuges: conyugesDe(person.id, relations, byId), hermanos: hermanosDe(person.id, relations, byId) };
  const name = `${person.nombres} ${person.apellidos}`;
  const investigation = (tab: string) => `/investigacion?tab=${tab}&persona=${encodeURIComponent(person.id)}`;
  return <div className="space-y-5">
    <label className="block text-sm font-medium">Persona a investigar
      <select className="mt-2 min-h-11 w-full rounded-xl border bg-card px-3 text-base" value={person.id} onChange={event => { const next = new URLSearchParams(params); next.set('persona', event.target.value); setParams(next); setIssues(null); }}>
        {people.map(p => <option key={p.id} value={p.id}>{p.nombres} {p.apellidos}</option>)}
      </select>
    </label>
    <GenealogistaIA context="persona" title="Investigación de la persona" personName={name} actions={[
      { label: 'Buscar evidencia', to: investigation('busqueda') },
      { label: 'Genealogista IA', to: buildAssistantContext(person.id, name) },
      { label: 'Revisar hipótesis', to: investigation('hipotesis') },
    ]} />
    {events.error ? <p role="alert">No se pudieron consultar los eventos de esta persona.</p> : <PersonaSmartInsights key={`person-${person.id}`} persona={person} eventos={events.data ?? []} fam={fam} />}
    <GenealogistaIA context="arbol" title="Investigación del árbol" personName={name} metrics={[{ label: 'Personas', value: people.length }, { label: 'Relaciones', value: relations.length }]} actions={[
      { label: 'Verificar coherencia', onClick: () => { setIssues(checkCoherence(people, relations)); } },
      { label: 'Agentes paralelos', to: investigation('paralelo') },
      { label: 'Tareas del árbol', to: investigation('tareas') },
    ]} />
    {issues && <div role="status" className="rounded-2xl border bg-card p-4"><p className="font-semibold">{issues.length ? `${issues.length} observaciones de coherencia` : 'No se encontraron problemas de coherencia.'}</p>{issues.map(issue => <p key={issue.id} className="mt-2 text-sm">{issue.message}</p>)}</div>}
    <TreeInsights key={`tree-${person.id}`} personaId={person.id} personaNombre={name} />
    <Link className="text-sm text-primary underline" to={`/personas/${person.id}`}>Volver a la ficha</Link>
  </div>;
}
