import { useState } from "react";
import { GeneIcon, geneIconNames } from "./GeneIcon";
import CountryFlag from "./CountryFlag";
import GeneTimeline from "./GeneTimeline";
import { countryCodes, countryName } from "@/lib/countries";
import { buildTimeline } from "@/lib/timeline";
import { useLanguage } from "@/contexts/LanguageContext";

// Fictional fixtures; the public preview never fetches an account's family records.
const person = { id: "demo-elena", nombres: "Elena", apellidos: "Ríos Martínez", nac_fecha: "1865-09-08", matrimonio_fecha: "1890-09-08", defuncion_fecha: "1934-04-12", nac_lugar_id: "it", matrimonio_lugar_id: "it", defuncion_lugar_id: "cl" };
const places = [{ id: "it", ciudad: "Génova", pais: "Italia" }, { id: "cl", ciudad: "Valparaíso", pais: "Chile" }];
const items = buildTimeline([person], [
  { id: "baptism", persona_id: person.id, tipo: "bautismo", fecha: "1865-09-09", lugar_id: "it", descripcion: "Evento de ejemplo para explorar el diseño de la cronología." },
  { id: "migration", persona_id: person.id, tipo: "inmigracion", fecha_aprox: "ABT 1896", lugar_id: "cl", lugar_original: "Génova → Valparaíso, Chile", descripcion: "Viaje de ejemplo. Los datos de esta vista son ficticios." },
], places);

export default function DesignAssets({ view }: { view: "timeline" | "icons" | "flags" }) {
  const { t, locale } = useLanguage();
  const [query, setQuery] = useState("");
  if (view === "timeline") return <div className="space-y-6"><h1 className="text-3xl font-semibold">{t("Línea de tiempo")}</h1><div className="rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Elena Ríos Martínez</h2><p className="mt-1 text-sm text-muted-foreground">1865–1934 · {t("Archivo de ejemplo")}</p></div><GeneTimeline items={items} /></div>;
  if (view === "icons") return <div className="space-y-6"><h1 className="text-3xl font-semibold">{t("Iconos de GENEAI")}</h1><div className="icon-catalog">{geneIconNames.map(name => <div key={name}><GeneIcon name={name} size={40} /><span>{name}</span></div>)}</div></div>;
  const countries = countryCodes.map(code => ({ code, name: countryName(code, locale) })).sort((a, b) => a.name.localeCompare(b.name, locale));
  return <div className="space-y-6"><h1 className="text-3xl font-semibold">{t("Banderas del mundo")}</h1><input className="min-h-11 w-full rounded-xl border bg-card px-4" aria-label={t("Buscar país…")} placeholder={t("Buscar país…")} value={query} onChange={e => setQuery(e.target.value)} /><div className="flag-catalog">{countries.filter(c => `${c.code} ${c.name}`.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale))).map(c => <div key={c.code}><CountryFlag country={c.code} /><span>{c.name}</span></div>)}</div></div>;
}
