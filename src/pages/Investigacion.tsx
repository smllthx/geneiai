import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { SectionHeader } from "@/components/glass";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Agente = lazy(() => import("./Agente"));
const AgentesParalelo = lazy(() => import("./AgentesParalelo"));
const InvestigacionExterna = lazy(() => import("./InvestigacionExterna"));
const Pistas = lazy(() => import("./Pistas"));
const Hipotesis = lazy(() => import("./Hipotesis"));
const Inferencias = lazy(() => import("./Inferencias"));
const BusquedaIA = lazy(() => import("./BusquedaIA"));
const Insights = lazy(() => import("./Insights"));

const TABS = [
  { v: "agente", l: "Agente IA", C: Agente },
  { v: "busqueda", l: "Búsqueda IA", C: BusquedaIA },
  { v: "insights", l: "Insights", C: Insights },
  { v: "paralelo", l: "Paralelo", C: AgentesParalelo },
  { v: "externas", l: "Web externa", C: InvestigacionExterna },
  { v: "pistas", l: "Pistas", C: Pistas },
  { v: "hipotesis", l: "Hipótesis", C: Hipotesis },
  { v: "inferencias", l: "Inferencias", C: Inferencias },
];

export default function Investigacion() {
  const [params, setParams] = useSearchParams();
  const current = params.get("tab") ?? "agente";

  return (
    <div>
      <SectionHeader
        eyebrow="Centro de investigación"
        title="Investigación familiar"
        subtitle="ChatGPT, búsquedas externas, pistas, hipótesis, agentes e inferencias en un solo lugar."
      />
      <Tabs value={current} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList className="mb-4 flex h-auto flex-wrap">
          {TABS.map((t) => <TabsTrigger key={t.v} value={t.v}>{t.l}</TabsTrigger>)}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.v} value={t.v} className="mt-0">
            <Suspense fallback={<div className="text-muted-foreground text-sm">Cargando…</div>}>
              <t.C />
            </Suspense>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
