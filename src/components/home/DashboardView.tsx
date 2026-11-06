import { GeneIcon, geneIcon } from "@/components/GeneIcon";
import { useLanguage } from "@/contexts/LanguageContext";
import { localizeDateLabel } from "@/lib/language";
import { lifeDates, type BirthFields } from "@/lib/personDates";
import PersonPortrait from "@/components/PersonPortrait";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, ChevronRight, Clock3, Compass, FileText, GitBranch, Image, MapPin, Plus, Search, Sparkles, Upload, UserRound, Users } from "@/components/icons";
import { toDisplayText } from "@/lib/safeText";

export type DashboardPerson = BirthFields & { viva?: string | null; defuncion_fecha?: string | null; id: string; nombres: string; apellidos: string | null; foto_url?: string | null };
export type DashboardStats = { personas: number; lugares: number; fotos: number; docsPendientes: number; coincidencias: number; hipotesis: number; inferencias: number; totalApellidos: number; apellidos: string[] };
export type DashboardActivity = { id: string; descripcion: unknown; created_at: string };
export type DashboardProps = {
  stats: DashboardStats;
  recientes: DashboardPerson[];
  vistasRecientes: DashboardPerson[];
  sinPadres: DashboardPerson[];
  sinFotos: DashboardPerson[];
  actividad: DashboardActivity[];
  loading?: boolean;
  loadError?: boolean;
  onRetry?: () => void;
  map?: ReactNode;
  timeline?: ReactNode;
};


/** A decorative diagram, never presented as the user's actual family tree. */
function TreeIllustration() {
  const { t } = useLanguage();
  return <div className="family-illustration" aria-hidden="true">
    <svg className="tree-desktop-illustration" viewBox="0 0 390 230" fill="none">
      <path d="M58 59V94Q58 108 72 108H122M164 59V94Q164 108 150 108H122M122 135V166Q122 180 138 180H196M228 59V94Q228 108 244 108H278M334 59V94Q334 108 318 108H278M278 135V166Q278 180 262 180H196V203" stroke="currentColor" strokeWidth="1.5" />
      {[58,164,228,334].map((x,i) => <g key={x} className={`tree-avatar tree-avatar-${i}`}>
        <rect x={x-23} y="15" width="46" height="46" rx="17" />
        <circle cx={x} cy="31" r="6" /><path d={`M${x-11} 49q0-12 11-12t11 12`} />
      </g>)}
      {[122,278].map(x => <g key={x} className="tree-avatar tree-avatar-mid">
        <rect x={x-28} y="93" width="56" height="56" rx="21" />
        <circle cx={x} cy="113" r="7" /><path d={`M${x-13} 136q0-15 13-15t13 15`} />
      </g>)}
      <g className="tree-avatar tree-avatar-root"><rect x="172" y="190" width="48" height="32" rx="16" /><path d="m188 206 5 5 10-10" /></g>
    </svg>
    <svg className="tree-compact-illustration" viewBox="0 0 130 180" fill="none">
      <path d="M29 53V76Q29 89 42 89H64M101 53V76Q101 89 88 89H64V115" stroke="currentColor" strokeWidth="1.5" />
      {[29,101].map((x,i) => <g key={x} className={`tree-avatar tree-avatar-${i}`}><rect x={x-21} y="15" width="42" height="42" rx="16" /><circle cx={x} cy="31" r="5" /><path d={`M${x-9} 47q0-11 9-11t9 11`} /></g>)}
      <g className="tree-avatar tree-avatar-mid"><rect x="40" y="109" width="49" height="49" rx="18" /><circle cx="64.5" cy="126" r="6" /><path d="M53 146q0-13 11.5-13T76 146" /></g>
    </svg>
    <span className="tree-illustration-caption">{t("Personas · vínculos · memoria")}</span>
  </div>;
}

function PersonRow({ person }: { person: DashboardPerson }) {
  const { t, language } = useLanguage();
  const fullName = [person.nombres, person.apellidos].filter(Boolean).join(" ");
  return <Link to={`/personas/${person.id}`} className="home-person-row">
    <PersonPortrait person={person} className="home-avatar" />
    <span className="home-person-name">{fullName || t("Persona sin nombre")}<small>{localizeDateLabel(lifeDates(person), language) || t("Ver historia familiar")}</small></span>
    <ChevronRight size={16} aria-hidden="true" />
  </Link>;
}

function DetailSection({ icon, title, children, onOpen }: { icon: ReactNode; title: string; children: ReactNode; onOpen?: (open: boolean) => void }) {
  const { t } = useLanguage();
  return <details className="home-detail" onToggle={event => onOpen?.(event.currentTarget.open)}>
    <summary>{icon}<span>{t(title)}</span><ChevronRight size={17} className="detail-chevron" aria-hidden="true" /></summary>
    <div className="home-detail-content">{children}</div>
  </details>;
}

function groupActivity(activity: DashboardActivity[]) {
  const groups = new Map<string, DashboardActivity & { label: string; count: number }>();
  for (const item of activity) {
    const label = toDisplayText(item.descripcion) || "Actividad registrada";
    const existing = groups.get(label);
    if (existing) existing.count += 1;
    else groups.set(label, { ...item, label, count: 1 });
  }
  return [...groups.values()].slice(0, 4);
}

export default function DashboardView({ stats, recientes, vistasRecientes, sinPadres, sinFotos, actividad, loading = false, loadError = false, onRetry, map, timeline }: DashboardProps) {
  const { t, locale, language } = useLanguage();
  const number = new Intl.NumberFormat(locale);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const pending = stats.docsPendientes + stats.coincidencias + stats.hipotesis + stats.inferencias;
  const people = (vistasRecientes.length ? vistasRecientes : recientes).slice(0, 4);
  const ready = !loading && !loadError;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (query.trim()) navigate(`/buscar?q=${encodeURIComponent(query.trim())}`);
  };
  return <div className="home-dashboard" aria-busy={loading}>
    <header className="home-heading">
      <div><p className="home-eyebrow">{t("Tu archivo familiar")}</p><h1>{t("Mi archivo familiar")}</h1><p>{t("Tu árbol, tus registros y las personas que has consultado.")}</p></div>
      <Link to="/personas/nueva" className="home-add glass-control"><GeneIcon name="add" size={18} /><span>{t("Añadir persona")}</span></Link>
    </header>

    {loadError && <div role="status" className="home-load-error"><p>{t("No se pudieron actualizar los datos.")}</p><button onClick={onRetry}>{t("Reintentar")}</button></div>}

    <form className="home-search" role="search" onSubmit={submit}>
      <GeneIcon name="search" size={21} aria-hidden="true" />
      <label className="sr-only" htmlFor="home-query">{t("Buscar en tu archivo familiar")}</label>
      <input id="home-query" value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Buscar en tu archivo…")} type="search" autoComplete="off" />
      <button type="submit" disabled={!query.trim()} aria-label={t("Buscar en el archivo")}><ArrowRight size={19} /></button>
    </form>

    <div className="home-feature-grid">
      <section className="home-tree-card">
        <div className="home-tree-copy"><span className="home-section-label"><GeneIcon name="tree" size={16} />{t("Tu árbol genealógico")}</span><h2>{t("Árbol de mi familia")}</h2><p>{t("Explora los vínculos que hacen única a tu familia.")}</p><Link to="/arbol" className="home-primary">{t("Explorar árbol")}<ArrowRight size={17} /></Link></div>
        <TreeIllustration />
        <div className="home-summary" aria-label={t("Resumen del archivo")}>
          {[
            { icon: "people", label: "Personas", value: stats.personas, to: "/personas" },
            { icon: "tag", label: "Apellidos", value: stats.totalApellidos, to: "/apellidos" },
            { icon: "pin", label: "Lugares", value: stats.lugares, to: "/lugares" },
            { icon: "photos", label: "Fotos", value: stats.fotos, to: "/fotos" },
          ].map(item => <Link to={item.to} key={item.label}><GeneIcon name={item.icon} size={25} /><strong>{loading || (loadError && !stats.personas) ? "—" : number.format(item.value)}</strong><span>{t(item.label)}</span></Link>)}
        </div>
      </section>


    </div>

    <nav className="home-shortcuts" aria-label={t("Accesos al archivo")}>
      {[{ label: "Documentos", icon: geneIcon("document"), to: "/documentos" }, { label: "Fotos", icon: geneIcon("photos"), to: "/fotos" }, { label: "ADN", icon: geneIcon("dna"), to: "/adn" }, { label: "Importar", icon: geneIcon("upload"), to: "/importar" }].map(({ label, icon: Icon, to }) => <Link key={to} to={to}><span><Icon size={19} /></span>{t(label)}<ChevronRight size={14} /></Link>)}
    </nav>

    <div className="home-secondary-grid">
      <section className="home-surface home-people">
        <div className="home-card-heading"><h2>{t("Continúa explorando")}</h2><Link className="home-text-link" to="/personas">{t("Ver todas")}<ArrowRight size={14} /></Link></div>
        <p className="home-section-description">{t(vistasRecientes.length ? "Las historias que visitaste recientemente." : "Las últimas personas de tu archivo.")}</p>
        {loading ? <p className="home-empty" role="status">{t("Cargando historias…")}</p> : people.length ? <div>{people.map(person => <PersonRow key={person.id} person={person} />)}</div> : <div className="home-empty"><GeneIcon name="user" size={24} /><p>{t(loadError ? "Tus historias estarán aquí cuando recuperemos la conexión." : "Toda historia comienza con una persona.")}</p>{!loadError && <Link to="/personas/nueva" className="home-text-link">{t("Crear mi primera persona")}<GeneIcon name="add" size={15} /></Link>}</div>}
      </section>
      <section className="home-discover">
        <div className="home-card-heading"><h2>{t("Más de tu familia")}</h2><span className="home-count-label">{t("A tu ritmo")}</span></div>
        <DetailSection title="Lugares y migraciones" icon={<GeneIcon name="pin" size={20} />} onOpen={setShowMap}>{showMap && map}<Link to="/lugares" className="home-text-link">{t("Explorar lugares")}<ArrowRight size={15} /></Link></DetailSection>
        <DetailSection title="Línea de tiempo" icon={<GeneIcon name="clock" size={20} />} onOpen={setShowTimeline}>{showTimeline && timeline}<Link to="/linea-de-tiempo" className="home-text-link">{t("Ver toda la historia")}<ArrowRight size={15} /></Link></DetailSection>
        <DetailSection title="Completar historias" icon={<GeneIcon name="people" size={20} />}>
          <h3>{t("Sin padres registrados")}</h3>{sinPadres.length ? sinPadres.slice(0, 3).map(person => <PersonRow key={person.id} person={person} />) : <p>{t(ready ? "No hay personas pendientes en esta lista." : "Esperando los datos del archivo.")}</p>}
          <h3>{t("Por añadir una foto")}</h3>{sinFotos.length ? sinFotos.slice(0, 3).map(person => <PersonRow key={person.id} person={person} />) : <p>{t(ready ? "No hay personas pendientes en esta lista." : "Esperando los datos del archivo.")}</p>}
        </DetailSection>
        <DetailSection title="Actividad reciente" icon={<GeneIcon name="clock" size={20} />}>
          {groupActivity(actividad).length ? groupActivity(actividad).map(item => <div className="home-activity-row" key={item.id}><p>{item.label}{item.count > 1 && <span> ×{item.count}</span>}</p><small>{new Date(item.created_at).toLocaleDateString(locale, { day: "numeric", month: "short" })}</small></div>) : <p>{t(ready ? "Tu actividad aparecerá aquí." : "Esperando los datos del archivo.")}</p>}
        </DetailSection>
      </section>
    </div>
      <section className="home-research home-surface home-research-compact mt-6">
        <div className="home-card-heading"><span className="home-section-label"><GeneIcon name="spark" size={17} />{t("Investigación")}</span><span className="home-ai-badge">{t("IA")}</span></div>
        <h2>{t(!ready ? "Tus próximas pistas" : pending ? "Hay más por descubrir." : "Un nuevo descubrimiento.")}</h2>
        <p>{loadError ? t("No se pudieron consultar las revisiones.") : loading ? t("Consultando las revisiones de tu archivo.") : pending ? `${number.format(pending)} ${t(pending === 1 ? "elemento para revisar" : "elementos para revisar")}` : t("Busca un antepasado o retoma una investigación.")}</p>
        <div className="home-research-list">
          {[
            { label: "Documentos", value: stats.docsPendientes, to: "/documentos", icon: geneIcon("document") },
            { label: "Coincidencias", value: stats.coincidencias, to: "/coincidencias", icon: geneIcon("compass") },
            { label: "Hipótesis", value: stats.hipotesis, to: "/hipotesis", icon: geneIcon("tree") },
            { label: "Inferencias", value: stats.inferencias, to: "/inferencias", icon: geneIcon("spark") },
          ].map(({ label, value, to, icon: Icon }) => <Link to={to} key={label}><Icon size={17} /><span>{t(label)}</span><strong data-pending={value > 0}>{ready ? number.format(value) : "—"}</strong><ChevronRight size={14} /></Link>)}
        </div>
        <Link to="/investigacion" className="home-research-action">{t("Abrir investigación")}<ArrowRight size={16} /></Link>
        <small className="home-review-note"><Check size={12} />{t("Tú confirmas cada hallazgo.")}</small>
      </section>
    {stats.apellidos.length > 0 && <footer className="home-surnames"><span>{t("Apellidos de tu historia")}</span><div>{stats.apellidos.slice(0, 6).map(surname => <Link key={surname} to={`/buscar?q=${encodeURIComponent(surname)}`}>{surname}</Link>)}</div></footer>}
  </div>;
}
