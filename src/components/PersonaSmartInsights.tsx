import { useEffect, useState } from "react";
import { Lightbulb, RefreshCw } from "lucide-react";
import { localPersonaInsight } from "@/lib/offlineAi";

const yearOf = (d?: string | null) => (d ? new Date(d).getUTCFullYear() : null);

type Insight = { icon?: string; texto: string };

/**
 * Smart Insights — curiosidades automáticas calculadas localmente
 * (sin gastar IA): longevidad, década, edad al casarse, número de hijos,
 * país de origen, edad de los padres al nacer, generación, etc.
 */
export default function PersonaSmartInsights({ persona, eventos = [], fam }: { persona: any; eventos?: any[]; fam: { padres: any[]; conyuges: any[]; hijos: any[]; hermanos: any[] } }) {
  const [extra, setExtra] = useState<Insight[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);
  const insights: Insight[] = [];
  const yN = yearOf(persona?.nac_fecha) ?? persona?.nac_rango_ini ?? null;
  const yD = yearOf(persona?.defuncion_fecha) ?? null;

  if (yN) {
    const decada = `${Math.floor(yN / 10) * 10}s`;
    insights.push({ icon: "🕰️", texto: `Nació en los ${decada}${persona?.nac_lugar ? ` en ${persona.nac_lugar}` : ""}.` });
  }
  if (yN && yD) {
    const vivio = yD - yN;
    insights.push({ icon: vivio >= 90 ? "🌟" : "⌛", texto: `Vivió ${vivio} años${vivio >= 90 ? " — longevidad excepcional para su época." : "."}` });
  }
  if (yN && persona?.viva === "si") {
    const edad = new Date().getUTCFullYear() - yN;
    insights.push({ icon: "💚", texto: `Persona viva, ${edad} años aproximadamente.` });
  }
  if (fam.hijos?.length) {
    insights.push({ icon: "👶", texto: `Tuvo ${fam.hijos.length} hijo${fam.hijos.length === 1 ? "" : "s"} registrado${fam.hijos.length === 1 ? "" : "s"}.` });
  }
  if (fam.hermanos?.length >= 5) {
    insights.push({ icon: "👨‍👩‍👧‍👦", texto: `Familia numerosa: ${fam.hermanos.length + 1} hermanos.` });
  }
  const matrimonio = yearOf(persona?.matrimonio_fecha);
  if (yN && matrimonio) {
    insights.push({ icon: "💍", texto: `Se casó a los ${matrimonio - yN} años.` });
  }
  if (persona?.nacionalidad) {
    insights.push({ icon: "🌍", texto: `Origen: ${persona.nacionalidad}.` });
  }
  if (persona?.ocupacion) {
    insights.push({ icon: "💼", texto: `Oficio conocido: ${persona.ocupacion}.` });
  }
  if (fam.padres?.length === 2) {
    const padre = fam.padres.find((x: any) => x.sexo === "masculino");
    const madre = fam.padres.find((x: any) => x.sexo === "femenino");
    const yp = yearOf(padre?.nac_fecha) ?? padre?.nac_rango_ini;
    const ym = yearOf(madre?.nac_fecha) ?? madre?.nac_rango_ini;
    if (yN && yp) insights.push({ icon: "👨", texto: `Su padre tenía ~${yN - yp} años cuando nació.` });
    if (yN && ym) insights.push({ icon: "👩", texto: `Su madre tenía ~${yN - ym} años cuando nació.` });
  }
  if (eventos?.length >= 3) {
    insights.push({ icon: "📜", texto: `${eventos.length} hechos vitales documentados en su vida.` });
  }
  if (yN) {
    const siglo = Math.floor((yN - 1) / 100) + 1;
    insights.push({ icon: "🏛️", texto: `Vivió en el siglo ${siglo}.` });
  }

  // Curiosidad extra local: no llama a IA externa.
  useEffect(() => {
    if (!persona?.id) return;
    setExtra([{ icon: "✨", texto: localPersonaInsight(persona) }]);
  }, [persona?.id, persona?.updated_at, refreshTick]);

  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ personId?: string }>).detail;
      if (!detail?.personId || detail.personId === persona?.id) setRefreshTick((n) => n + 1);
    };
    window.addEventListener("genaia:smart-insights-refresh", refresh);
    window.addEventListener("genaia:data-changed", refresh);
    return () => {
      window.removeEventListener("genaia:smart-insights-refresh", refresh);
      window.removeEventListener("genaia:data-changed", refresh);
    };
  }, [persona?.id]);

  const all = [...insights, ...extra];
  if (all.length === 0) return null;

  return (
    <div className="mb-5 rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-transparent to-accent/[0.05] p-4 md:p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Lightbulb className="h-4 w-4" />
        </div>
        <h2 className="font-display text-lg font-bold tracking-tight">Smart Insights</h2>
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">Local</span>
        <button
          type="button"
          onClick={() => setRefreshTick((n) => n + 1)}
          className="grid h-7 w-7 place-items-center rounded-full border border-primary/15 text-primary transition hover:bg-primary/10"
          aria-label="Actualizar insights"
          title="Actualizar insights"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {all.map((i, idx) => (
          <li key={idx} className="flex items-start gap-2 rounded-2xl bg-card/50 px-3 py-2 text-[14px] leading-snug">
            <span className="shrink-0 text-base">{i.icon ?? "•"}</span>
            <span>{i.texto}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
