import { useState } from "react";
import { GeneIcon, geneIconNames } from "./GeneIcon";
import CountryFlag from "./CountryFlag";
import GeneTimeline from "./GeneTimeline";
import { countryCodes, countryName } from "@/lib/countries";
import { buildTimeline } from "@/lib/timeline";
import { useLanguage } from "@/contexts/LanguageContext";

// Fictional fixtures; the public preview never fetches an account's family records.
const person = { id: "demo-elena", nombres: "Elena", apellidos: "Ríos Martínez", nac_fecha: "1865-09-08", matrimonio_fecha: "1890-09-08", defuncion_fecha: "1934-04-12", entierro_fecha: "1934-04-14", nac_lugar_id: "it", matrimonio_lugar_id: "it", defuncion_lugar_id: "cl", entierro_lugar_id: "cl" };
const places = [{ id: "it", ciudad: "Génova", pais: "Italia" }, { id: "cl", ciudad: "Valparaíso", pais: "Chile" }];
const items = buildTimeline([person], [
  { id: "baptism", persona_id: person.id, tipo: "bautismo", fecha: "1865-09-09", lugar_id: "it", descripcion: "Evento de ejemplo para explorar el diseño de la cronología." },
  { id: "migration", persona_id: person.id, tipo: "inmigracion", fecha_aprox: "ABT 1896", lugar_id: "cl", lugar_original: "Génova → Valparaíso, Chile", descripcion: "Viaje de ejemplo. Los datos de esta vista son ficticios." },
], places);

const iconLabels: Record<string, string> = {
  home: "Inicio", tree: "Árbol Genealógico", archive: "Archivo familiar", compass: "Descubrimientos",
  search: "Investigación", photos: "Fotos", dna: "ADN", tools: "Herramientas y cuenta",
  birth: "Nacimiento", marriage: "Matrimonio", baptism: "Bautismo", death: "Defunción", burial: "Sepultura / entierro",
  ship: "Migración", work: "Profesión", people: "Familia", user: "Persona", pin: "Lugares",
  calendar: "Calendario", timeline: "Línea de tiempo", heart: "Vínculos", document: "Documentos",
  source: "Fuentes", book: "Archivo histórico", branches: "Parentescos", fan: "Abanico",
  photo: "Fotografía", spark: "Asistente IA", bulb: "Pistas", flask: "Análisis", compare: "Comparar",
  merge: "Fusionar", folder: "Carpeta", tag: "Etiquetas", layers: "Capas", globe: "Mundo",
  language: "Idioma", mail: "Mensajes", clock: "Historial", settings: "Configuración",
  sliders: "Preferencias", building: "Institución", grid: "Vista de cuadrícula", checklist: "Revisión",
  sync: "Actualizar", upload: "Importar", download: "Exportar", filter: "Filtrar", zoom: "Acercar",
  screen: "Pantalla", link: "Enlace", external: "Abrir enlace", logout: "Cerrar sesión",
  menu: "Menú", more: "Más opciones", add: "Añadir", minus: "Reducir", check: "Confirmar",
  close: "Cerrar", back: "Volver", arrow: "Continuar", chevron: "Siguiente", chevrondown: "Desplegar",
  expand: "Ampliar", circle: "Seleccionar",
};
const navigationIcons = ["home", "tree", "archive", "compass", "search", "photos", "dna", "tools"];
const eventIcons = ["birth", "marriage", "baptism", "death", "burial", "ship", "work", "people", "pin"];
const iconGroups = [
  { title: "Navegación", names: navigationIcons },
  { title: "Historia familiar", names: eventIcons },
  { title: "Acciones y herramientas", names: geneIconNames.filter(name => !navigationIcons.includes(name) && !eventIcons.includes(name)) },
];

export default function DesignAssets({ view }: { view: "timeline" | "icons" | "flags" }) {
  const { t, locale } = useLanguage();
  const [query, setQuery] = useState("");
  if (view === "timeline") return <div className="space-y-6"><h1 className="text-3xl font-semibold">{t("Línea de tiempo")}</h1><div className="rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Elena Ríos Martínez</h2><p className="mt-1 text-sm text-muted-foreground">1865–1934 · {t("Archivo de ejemplo")}</p></div><GeneTimeline items={items} /></div>;
  if (view === "icons") return <div className="space-y-8">
    <h1 className="text-3xl font-semibold">{t("Iconos de GENEAI")}</h1>
    {iconGroups.map(group => <section key={group.title} className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">{t(group.title)}</h2>
      <div className="icon-catalog icon-catalog-glass">{group.names.map(name => <div key={name}>
        <GeneIcon name={name} size={36} /><span>{t(iconLabels[name] || name)}</span>
      </div>)}</div>
    </section>)}
  </div>;
  const countries = countryCodes.map(code => ({ code, name: countryName(code, locale) })).sort((a, b) => a.name.localeCompare(b.name, locale));
  return <div className="space-y-6"><h1 className="text-3xl font-semibold">{t("Banderas del mundo")}</h1><input className="min-h-11 w-full rounded-xl border bg-card px-4" aria-label={t("Buscar país…")} placeholder={t("Buscar país…")} value={query} onChange={e => setQuery(e.target.value)} /><div className="flag-catalog">{countries.filter(c => `${c.code} ${c.name}`.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale))).map(c => <div key={c.code}><CountryFlag country={c.code} /><span>{c.name}</span></div>)}</div></div>;
}
