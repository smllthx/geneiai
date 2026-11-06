import GeneTimeline from "./GeneTimeline";
import { useArchiveTimeline } from "@/hooks/useArchiveTimeline";
import { useLanguage } from "@/contexts/LanguageContext";

export default function FamilyTimeline() {
  const { items, loading, error, retry } = useArchiveTimeline();
  const { t } = useLanguage();
  if (loading) return <p role="status">{t("Cargando…")}</p>;
  if (error) return <div role="alert"><p>{t("No se pudo cargar la cronología.")}</p><button className="min-h-11 text-primary" onClick={retry}>{t("Reintentar")}</button></div>;
  return <GeneTimeline items={items} showPeople filters initialOrientation="vertical" />;
}
