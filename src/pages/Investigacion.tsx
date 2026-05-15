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

const TABS = [
  { v: "agente", l: "Agente IA", C: Agente },
  { v: "paralelo", l: "Paralelo", C: AgentesParalelo },
  { v: "externas", l: "Búsquedas externas", C: InvestigacionExterna },
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
        title="Investigación"
        subtitle="Toda la inteligencia investigativa en un solo lugar: agente IA, búsquedas externas, pistas, hipótesis e inferencias."
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
