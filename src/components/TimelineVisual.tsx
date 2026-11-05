import { useMemo } from "react";
import GeneTimeline from "./GeneTimeline";
import { buildTimeline, type TimelineEvent, type TimelinePerson, type TimelinePlace } from "@/lib/timeline";
import { useLanguage } from "@/contexts/LanguageContext";

export default function TimelineVisual({ eventos, persona, lugares = [] }: { eventos: TimelineEvent[]; persona: TimelinePerson; lugares?: TimelinePlace[] }) {
  const { t } = useLanguage();
  const items = useMemo(() => buildTimeline([persona], eventos, lugares), [persona, eventos, lugares]);
  return items.length ? <GeneTimeline items={items} /> : <p className="text-sm text-muted-foreground">{t("Sin fechas suficientes para construir una línea de tiempo.")}</p>;
}
