import { useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, X } from "lucide-react";
import { GeneIcon } from "./GeneIcon";
import CountryFlag from "./CountryFlag";
import PersonPortrait from "./PersonPortrait";
import { eventTypes, timelineDate, type TimelineItem } from "@/lib/timeline";
import { useLanguage } from "@/contexts/LanguageContext";

export default function GeneTimeline({ items, showPeople = false, initialOrientation, filters = false }: { items: TimelineItem[]; showPeople?: boolean; initialOrientation?: "horizontal" | "vertical"; filters?: boolean }) {
  const { language, t, locale } = useLanguage();
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">(() => {
    if (initialOrientation) return initialOrientation;
    try { return localStorage.getItem("geneai:timeline-orientation") === "horizontal" ? "horizontal" : "vertical"; } catch { return "vertical"; }
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [limit, setLimit] = useState(80);
  const id = useId();
  const filtered = useMemo(() => items.filter(item => {
    const text = `${item.person?.nombres || ""} ${item.person?.apellidos || ""} ${item.place} ${item.description || ""}`.toLocaleLowerCase(locale);
    return (!type || item.type === type) && text.includes(query.toLocaleLowerCase(locale).trim());
  }), [items, type, query, locale]);
  useEffect(() => { setLimit(80); setSelected(null); }, [type, query]);
  const active = filtered.find(item => item.id === selected);
  const number = new Intl.NumberFormat(locale);
  const detail = (item: TimelineItem) => <div id={`${id}-detail`} className="timeline-detail" role="region" aria-label={t("Detalle del evento")}>
    <div className="flex items-center gap-3"><GeneIcon name={eventTypes[item.type].icon} size={34} /><div><p className="text-xs uppercase tracking-wider text-muted-foreground">{t("Detalle del evento")}</p><h3 className="text-xl font-semibold">{t(eventTypes[item.type].label)}</h3></div><button type="button" onClick={() => { setSelected(null); document.getElementById(`${id}-${item.id}`)?.focus(); }} className="ml-auto grid h-11 w-11 place-items-center rounded-xl hover:bg-foreground/5" aria-label={t("Cerrar")}><X size={20} /></button></div>
    <dl className="timeline-facts"><div><dt>{t("Fecha")}</dt><dd>{timelineDate(item, language, true) || t("Sin fecha registrada")}</dd></div><div><dt>{t("Lugar")}</dt><dd className="flex items-center gap-2">{item.place && <CountryFlag country={item.country || item.place} />}<span>{item.place || t("Sin lugar registrado")}</span></dd></div>{showPeople && item.person && <div><dt>{t("Personas")}</dt><dd>{item.person.nombres} {item.person.apellidos}</dd></div>}{item.certainty && <div><dt>{t("Certeza")}</dt><dd>{item.certainty}</dd></div>}</dl>
    {item.description && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{item.description}</p>}
    <div className="mt-4 flex flex-wrap items-center gap-4 border-t pt-3 text-sm">
      {item.sourceId ? <Link to={`/documentos/${encodeURIComponent(item.sourceId)}`} className="inline-flex min-h-11 items-center gap-2 text-primary"><GeneIcon name="source" size={20} />{t("Abrir fuente")}</Link> : <span className="text-muted-foreground">{t("Sin fuente vinculada")}</span>}
      {item.person && <Link to={`/personas/${item.person.id}`} className="inline-flex min-h-11 items-center gap-2 text-primary"><GeneIcon name="user" size={20} />{t("Ver persona")}</Link>}
    </div>
  </div>;
  return <section className="gene-timeline" aria-label={t("Línea de tiempo")}>
    <div className="timeline-toolbar"><h2 className="flex items-center gap-2 text-lg font-semibold">{t("Acontecimientos")}<span className="rounded-md border px-2 text-xs text-muted-foreground">{number.format(filtered.length)}</span></h2><div className="timeline-switch" role="group" aria-label={t("Vista")}>
      {(["horizontal", "vertical"] as const).map(mode => <button type="button" key={mode} aria-pressed={orientation === mode} onClick={() => { setOrientation(mode); try { localStorage.setItem("geneai:timeline-orientation", mode); } catch { /* optional persistence */ } }}><GeneIcon name="timeline" size={20} className={mode === "vertical" ? "rotate-90" : ""} />{t(mode === "horizontal" ? "Horizontal" : "Vertical")}</button>)}
    </div></div>
    {filters && <div className="timeline-filters"><input aria-label={t("Buscar persona o lugar…")} placeholder={t("Buscar persona o lugar…")} value={query} onChange={e => setQuery(e.target.value)} type="search" /><select aria-label={t("Evento")} value={type} onChange={e => setType(e.target.value)}><option value="">{t("Todos los eventos")}</option>{Object.entries(eventTypes).map(([key, value]) => <option key={key} value={key}>{t(value.label)}</option>)}</select></div>}
    {filtered.length === 0 ? <p className="py-6 text-sm text-muted-foreground">{t("No hay eventos que coincidan.")}</p> : <>
      <ol className={`timeline-track timeline-${orientation}`}>
        {filtered.slice(0, limit).map(item => <li key={item.id} className="timeline-node" data-open={selected === item.id}>
          <button id={`${id}-${item.id}`} type="button" className="timeline-event" aria-expanded={selected === item.id} aria-controls={selected === item.id ? `${id}-detail` : undefined} onClick={() => setSelected(selected === item.id ? null : item.id)}>
            <span className="timeline-event-icon"><GeneIcon name={eventTypes[item.type].icon} size={30} /></span>
            <span className="timeline-date">{timelineDate(item, language) || t("Sin fecha registrada")}</span>
            <span className="timeline-title">{t(eventTypes[item.type].label)}{showPeople && item.person && <span className="timeline-person"><PersonPortrait person={item.person} className="h-7 w-7 shrink-0 rounded-full" /><span>{item.person.nombres} {item.person.apellidos}</span></span>}</span>
            <span className="timeline-place">{item.place && <><CountryFlag country={item.country || item.place} decorative /><span>{item.place}</span></>}</span><ChevronDown size={16} className="timeline-chevron" />
          </button>
          {orientation === "vertical" && selected === item.id && detail(item)}
        </li>)}
      </ol>
      {orientation === "horizontal" && active && detail(active)}
      {filtered.length > limit && <button type="button" className="mt-4 min-h-11 rounded-lg border px-5 text-sm" onClick={() => setLimit(n => n + 80)}>{t("Mostrar más")}</button>}
    </>}
  </section>;
}
