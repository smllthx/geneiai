import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SectionHeader } from '@/components/glass';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SectionPlaceholder from '@/components/SectionPlaceholder';
import { ResearchLogPanel } from '@/components/ResearchWorkflowPanel';

const SearchPage = lazy(() => import("./Buscar"));
const pages = {
  cerebros: { label: 'Análisis de personas y árbol', Component: lazy(() => import('./ResearchBrains')) },
  hub: { label: 'Archivo y catálogos', Component: () => <SearchPage embedded /> },
  externas: { label: 'Consultas externas guardadas', Component: lazy(() => import('./InvestigacionExterna')) },
  asistente: { label: 'Genealogista IA', Component: lazy(() => import('./Asistente')) },
  busqueda: { label: 'Búsqueda con IA', Component: lazy(() => import('./BusquedaIA')) },
  agente: { label: 'Agente guiado', Component: lazy(() => import('./Agente')) },
  paralelo: { label: 'Agentes paralelos', Component: lazy(() => import('./AgentesParalelo')) },
  pistas: { label: 'Pistas', Component: lazy(() => import('./Pistas')) },
  hipotesis: { label: 'Hipótesis', Component: lazy(() => import('./Hipotesis')) },
  inferencias: { label: 'Inferencias', Component: lazy(() => import('./Inferencias')) },
  insights: { label: 'Resumen del árbol', Component: lazy(() => import('./Insights')) },
  tareas: { label: 'Tareas IA', Component: lazy(() => import('./TareasIA')) },
  sugerencias: { label: 'Sugerencias y relaciones', Component: lazy(() => import('./Sugerencias')) },
  importadas: { label: 'Importadas pendientes', Component: lazy(() => import('./PersonasImportadasPendientes')) },
  bitacora: { label: 'Bitácora', Component: ResearchLogPanel },
};
type PageKey = keyof typeof pages;
const groups: { key: string; label: string; pages: PageKey[] }[] = [
  { key: 'buscar', label: 'Buscar', pages: ['hub', 'externas'] },
  { key: 'ia', label: 'IA', pages: ['cerebros', 'asistente', 'busqueda', 'agente', 'paralelo'] },
  { key: 'revisar', label: 'Revisar', pages: ['pistas', 'hipotesis', 'inferencias', 'insights', 'tareas', 'sugerencias', 'importadas'] },
  { key: 'historial', label: 'Historial', pages: ['bitacora'] },
];

export default function Investigacion() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') ?? 'hub';
  const current: PageKey = Object.prototype.hasOwnProperty.call(pages, requested) ? requested as PageKey : 'hub';
  const group = groups.find(group => group.pages.includes(current))!;
  const ActivePage = pages[current].Component;
  const changePage = (page: PageKey) => {
    const next = new URLSearchParams(params); next.set('tab', page); setParams(next);
  };
  return <div>
    <SectionHeader eyebrow="Centro de investigación" title="Investigación familiar" subtitle="Busca fuentes, trabaja con IA y revisa cada hallazgo en un solo lugar." />
    <Tabs value={group.key} onValueChange={key => changePage(groups.find(group => group.key === key)!.pages[0])}>
      <TabsList className="research-tabs mb-4 grid h-auto w-full max-w-lg grid-cols-4 p-1">
        {groups.map(group => <TabsTrigger key={group.key} value={group.key} className="min-h-11">{group.label}</TabsTrigger>)}
      </TabsList>
      <TabsContent value={group.key} className="mt-0">
        {group.pages.length > 1 && <label className="mb-5 flex flex-wrap items-center gap-3 text-sm font-medium">{group.label === 'Revisar' ? 'Qué revisar' : 'Herramienta'}
          <select aria-label="Herramienta de investigación" value={current} onChange={event => changePage(event.target.value as PageKey)} className="min-h-11 max-w-full rounded-xl border bg-card px-3 text-base">
            {group.pages.map(key => <option key={key} value={key}>{pages[key].label}</option>)}
          </select>
        </label>}
        <Suspense fallback={<SectionPlaceholder />}><ActivePage /></Suspense>
      </TabsContent>
    </Tabs>
  </div>;
}
