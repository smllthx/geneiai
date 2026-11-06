import PageHeader from "@/components/PageHeader";
import GeneTimeline from "@/components/GeneTimeline";
import { useArchiveTimeline } from "@/hooks/useArchiveTimeline";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LineaDeTiempo() {
  const { items, loading, error, retry } = useArchiveTimeline();
  const { t } = useLanguage();
  return <div>
    <PageHeader title="Línea de tiempo" subtitle="Todos los eventos del archivo, ordenados cronológicamente." />
    {error && <div role="alert" className="mb-4 rounded-xl border p-4"><p>{t("No se pudo cargar la cronología.")}</p><button className="min-h-11 text-primary" onClick={retry}>{t("Reintentar")}</button></div>}
    {loading ? <p role="status">{t("Cargando…")}</p> : <GeneTimeline items={items} showPeople filters />}
  </div>;
}
