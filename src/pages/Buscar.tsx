import { useDeferredValue, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Building2, ExternalLink, Cross, FileSearch, Image, Library, Loader2, Map, Search, Sparkles, Trees, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { expandTerm, fuzzyScore, norm } from "@/lib/search/fuzzy";
import { personaCode, matchesCode, normalizeCode } from "@/lib/personaCode";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { collectPages } from "@/lib/collectPages";
import { buildResearchLinks, catalogUrl, criteriaFromParams, criteriaToParams, type ResearchCriteria } from "@/lib/researchSearch";
import { toDisplayText } from "@/lib/safeText";
import { applyTreeScope, fetchAllPeople, getActiveTreeId } from "@/lib/peopleData";

type Cat = "personas" | "documentos" | "eventos" | "hipotesis" | "lugares";

interface Hit {
  id: string;
  cat: Cat;
  label: string;
  sub?: string;
  score: number;
  to?: string;
}

const CAT_LABEL: Record<Cat, string> = {
  personas: "Personas",
  documentos: "Documentos",
  eventos: "Eventos",
  hipotesis: "Hipótesis",
  lugares: "Lugares",
};

const SEARCH_MODES = [
  { key: "registros", label: "Registros", icon: FileSearch, desc: "Actas, censos, padrones y documentos indexados." },
  { key: "texto", label: "Texto completo", icon: BookOpen, desc: "Buscar dentro de transcripciones, OCR y notas." },
  { key: "imagenes", label: "Imágenes", icon: Image, desc: "Explorar fotos, documentos e imágenes históricas." },
  { key: "arbol", label: "Árbol familiar", icon: Trees, desc: "Buscar personas y relaciones dentro del árbol." },
  { key: "genealogias", label: "Genealogías", icon: Users, desc: "Colecciones familiares, ramas y clanes." },
  { key: "catalogo", label: "Catálogo", icon: Library, desc: "Lugar, título, autor, tema, apellido o referencia." },
  { key: "libros", label: "Libros", icon: Building2, desc: "Libros genealógicos e historia local." },
  { key: "wiki", label: "Wiki", icon: Map, desc: "Guías de investigación por país y época." },
  { key: "cementerios", label: "Cementerios", icon: Cross, desc: "Entierros, sepulturas y memoriales." },
];

export default function Buscar({ embedded = false }: { embedded?: boolean }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const q = params.get("q") ?? "";
  const mode = SEARCH_MODES.some(m => m.key === params.get("modo")) ? params.get("modo")! : "registros";
  const criteria = criteriaFromParams(params);
  const [advanced, setAdvanced] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const update = (patch: ResearchCriteria) => setParams(criteriaToParams({ ...criteria, ...patch }, mode, q, params), { replace: true });
  const setQ = (value: string) => setParams(criteriaToParams(criteria, mode, value, params), { replace: true });
  const links = buildResearchLinks({ ...criteria, keywords: criteria.keywords || q }, mode);
  const localQuery = useDeferredValue(q || [criteria.givenName, criteria.surname, criteria.place, criteria.keywords].filter(Boolean).join(" "));
  const tree = useQuery({
    queryKey: ["research-tree", user?.id], queryFn: () => getActiveTreeId(user?.id), enabled: !!user,
  });
  const treeId = tree.data;
  const index = useQuery({
    queryKey: ["research-index", user?.id, treeId], enabled: !!user && treeId !== undefined && localQuery.trim().length >= 2,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const [people, d, e, h, l] = await Promise.all([
        fetchAllPeople<Pick<Tables<"personas">, "id" | "nombres" | "apellidos" | "variantes_nombre" | "notas">>("id, nombres, apellidos, variantes_nombre, notas", { treeId, signal }),
        collectPages((from, to) => applyTreeScope(supabase.from("documentos").select("id, titulo, tipo, transcripcion, resumen, ocr_texto, cita, repositorio, url").order("id").range(from, to).abortSignal(signal), treeId)),
        collectPages((from, to) => applyTreeScope(supabase.from("eventos").select("id, tipo, descripcion, lugar_original, persona_id").order("id").range(from, to).abortSignal(signal), treeId)),
        collectPages((from, to) => supabase.from("hipotesis").select("id, titulo, descripcion, personas").order("id").range(from, to).abortSignal(signal)),
        collectPages((from, to) => supabase.from("lugares").select("id, ciudad, provincia, region, pais, parroquia").order("id").range(from, to).abortSignal(signal)),
      ]);
      const ids = new Set(people.map(person => person.id));
      const scopedHypotheses = treeId ? h.filter(row => !row.personas?.length || row.personas.some(id => ids.has(id))) : h;
      return { people, d, e, h: scopedHypotheses, l };
    },
  });
  const loading = index.isFetching || (tree.isPending && !!user && localQuery.length >= 2);
  const loadError = index.isError || tree.isError;
  const expansionInfo = useMemo(() => [...new Set(localQuery.split(/\s+/).flatMap(expandTerm))].filter(e => e.length >= 2 && e !== norm(localQuery)), [localQuery]);
  const hits = useMemo(() => {
    if (!index.data || localQuery.trim().length < 2) return [];
    const q = localQuery;
    const { people, d, e, h, l } = index.data;
    const all: Hit[] = [];

    // Detectar si el query parece un código de identificación (GDVB-TS5)
    const codeNorm = normalizeCode(q);
    const looksLikeCode = /^[A-Z2-9]{2,}-?[A-Z2-9]*$/i.test(q.trim()) && codeNorm.length >= 3;

    for (const r of people ?? []) {
      const variantes = (r.variantes_nombre ?? []).join(" ");
      const text = `${r.nombres} ${r.apellidos} ${variantes} ${r.notas ?? ""}`;
      let score = fuzzyScore(q, text);
      if (looksLikeCode && matchesCode(q, r.id)) score = 1;
      if (score >= 0.7) all.push({
        id: r.id, cat: "personas", label: `${r.nombres} ${r.apellidos}`.trim(),
        sub: `${personaCode(r.id)}${variantes ? ` · también: ${variantes}` : ""}`,
        score, to: `/personas/${r.id}`,
      });
    }
    for (const r of d ?? []) {
      const text = `${r.titulo} ${r.resumen ?? ""} ${r.transcripcion ?? ""} ${r.ocr_texto ?? ""} ${r.cita ?? ""} ${r.repositorio ?? ""} ${r.url ?? ""}`;
      const score = fuzzyScore(q, text);
      if (score >= 0.7) all.push({
        id: r.id, cat: "documentos", label: r.titulo, sub: r.tipo,
        score, to: `/documentos/${r.id}`,
      });
    }
    for (const r of e ?? []) {
      const descripcion = toDisplayText(r.descripcion);
      const text = `${r.tipo} ${descripcion} ${r.lugar_original ?? ""}`;
      const score = fuzzyScore(q, text);
      if (score >= 0.7) all.push({
        id: r.id, cat: "eventos", label: `${r.tipo}: ${descripcion || r.lugar_original || ""}`,
        score, to: r.persona_id ? `/personas/${r.persona_id}` : undefined,
      });
    }
    for (const r of h ?? []) {
      const descripcion = toDisplayText(r.descripcion);
      const text = `${r.titulo} ${descripcion}`;
      const score = fuzzyScore(q, text);
      if (score >= 0.7) all.push({
        id: r.id, cat: "hipotesis", label: r.titulo, sub: descripcion.slice(0, 80),
        score, to: `/hipotesis`,
      });
    }
    for (const r of l ?? []) {
      const parts = [r.parroquia, r.ciudad, r.provincia, r.region, r.pais].filter(Boolean);
      const text = parts.join(" ");
      const score = fuzzyScore(q, text);
      if (score >= 0.7) all.push({
        id: r.id, cat: "lugares", label: parts.join(", "),
        score, to: `/lugares?lugar=${encodeURIComponent(r.id)}`,
      });
    }

    all.sort((a, b) => b.score - a.score);
    return all.slice(0, 100);
  }, [index.data, localQuery]);

  const grouped = useMemo(() => {
    const g: Record<Cat, Hit[]> = { personas: [], documentos: [], eventos: [], hipotesis: [], lugares: [] };
    hits.forEach((h) => g[h.cat].push(h));
    return g;
  }, [hits]);

  return (
    <div className="research-workspace mx-auto max-w-5xl space-y-5">
      {!embedded && <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Investigación y búsqueda</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Hub de búsqueda genealógica: registros, texto completo, imágenes, árbol, genealogías, catálogo, libros, wiki y cementerios.
        </p>
      </div>}

      <div className="research-modes" aria-label="Tipo de búsqueda">
        {SEARCH_MODES.map(({ key, label, icon: Icon, desc }) => (
          <button
            key={key}
            type="button"
            onClick={() => setParams(criteriaToParams(criteria, key, q, params), { replace: true })}
            aria-pressed={mode === key}
            title={desc}
            className={`research-mode rounded-2xl border p-3 text-left transition hover:shadow-sm ${mode === key ? "border-primary bg-primary/5" : "bg-card"}`}
          >
            <Icon className="mb-2 h-5 w-5 text-primary" />
            <p className="font-medium">{label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
          </button>
        ))}
      </div>

      <form role="search" className="research-form glass-card p-4 sm:p-6" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); document.getElementById("research-links")?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }}>
        <h2 className="mb-4 font-semibold">¿Qué quieres descubrir?</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([{ key: "givenName", label: "Nombres", placeholder: "María" }, { key: "surname", label: "Apellidos", placeholder: "Ríos" }, { key: "place", label: "Lugar", placeholder: "Ciudad, parroquia o país" }, { key: "year", label: "Año aproximado", placeholder: "1900" }] as const).map(field => (
            <label key={field.key} className="text-xs font-medium">{field.label}
              <input value={criteria[field.key]} onChange={e => update({ [field.key]: e.target.value })} inputMode={field.key === "year" ? "numeric" : "text"} placeholder={field.placeholder} className="mt-1.5 w-full rounded-xl border bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40" />
            </label>
          ))}
        </div>
        {(advanced || mode === "catalogo" || mode === "texto" || mode === "libros") && <div id="research-options" className="mt-3 grid grid-cols-[minmax(0,1fr)_135px] gap-3 sm:grid-cols-[1fr_180px]">
          <label className="text-xs font-medium">Título, tema o referencia<input value={criteria.keywords} onChange={e => update({ keywords: e.target.value })} placeholder="Registro civil, microfilme, autor…" className="mt-1.5 w-full rounded-xl border bg-background px-3 py-3 text-base" /></label>
          <label className="text-xs font-medium">Campo del catálogo<select value={criteria.catalogField} onChange={e => update({ catalogField: e.target.value as ResearchCriteria["catalogField"] })} className="mt-1.5 min-h-12 w-full rounded-xl border bg-background px-3 text-base">
            <option value="keywords">Palabras clave</option><option value="title">Título</option><option value="author">Autor</option><option value="subject">Tema</option><option value="surname">Apellido</option>
          </select></label>
        </div>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit"><Search className="h-4 w-4" /> Buscar</Button>
          <Button type="button" variant="outline" aria-expanded={advanced} aria-controls="research-options" onClick={() => setAdvanced(v => !v)}>Más opciones</Button>
          <Button type="button" variant="outline" onClick={() => navigate(`/investigacion?${criteriaToParams(criteria, mode, localQuery, new URLSearchParams("tab=busqueda"))}`)}><Sparkles className="h-4 w-4" /> Buscar con IA</Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Un criterio, varias fuentes. El catálogo también permite encontrar colecciones sin nombres indexados.</p>
        {submitted && !links.length && <p role="status" className="mt-2 text-sm">Escribe un nombre, lugar o tema para empezar.</p>}
      </form>

      {links.length > 0 && <section id="research-links" aria-label="Búsquedas externas" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2"><h2 className="font-display text-xl font-semibold">Explorar las fuentes</h2><span className="text-xs text-muted-foreground">Enlaces preparados · resultados en cada proveedor</span></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{links.map((link, i) => <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" data-external-browser="true" className={`research-source glass-card p-4 ${i === 0 ? "border-primary/40 bg-primary/5" : ""}`}>
          <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{link.label}</span><ExternalLink className="h-4 w-4 shrink-0 text-primary" /></div>
          <p className="mt-2 text-xs text-muted-foreground">{link.description}</p>
        </a>)}</div>
      </section>}

      <div className="glass-strong flex items-center gap-2 rounded-2xl px-4 py-3">
        <Search className="h-5 w-5 text-muted-foreground" />
        <input
          aria-label="Buscar en el archivo"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, apellido, código (ej. GDVB-TS5), lugar, palabra en acta…"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-xs text-muted-foreground">
        Cada persona tiene un código único de 7 caracteres (estilo <code>GDVB-TS5</code>). Puedes copiarlo desde la ficha y pegarlo aquí para encontrarla al instante.
      </p>

      {expansionInfo.length > 0 && (
        <div className="glass-card flex flex-wrap items-center gap-1.5 p-3 text-xs">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-muted-foreground">también buscando:</span>
          {expansionInfo.slice(0, 12).map((e) => (
            <span key={e} className="glass-pill">{e}</span>
          ))}
        </div>
      )}

      {loadError && <div role="alert" className="glass-card p-4 text-sm">No se pudo consultar tu archivo. Los enlaces externos siguen disponibles. <Button variant="outline" size="sm" onClick={() => void (tree.isError ? tree.refetch() : index.refetch())}>Reintentar</Button></div>}

      {localQuery.length >= 2 && hits.length === 0 && !loading && !loadError && (
        <p className="text-sm text-muted-foreground">Sin coincidencias en el archivo consultado. Prueba las fuentes externas de arriba.</p>
      )}

      {(Object.keys(grouped) as Cat[]).map((cat) => (
        grouped[cat].length === 0 ? null : (
          <div key={cat}>
            <h2 className="mb-2 font-display text-lg font-semibold">
              {CAT_LABEL[cat]} <span className="text-sm font-normal text-muted-foreground">({grouped[cat].length})</span>
            </h2>
            <div className="grid gap-2">
              {grouped[cat].map((h) => {
                const inner = (
                  <div className="glass-card flex items-center justify-between gap-3 p-3 transition-all hover:bg-foreground/5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{h.label}</p>
                      {h.sub && <p className="truncate text-xs text-muted-foreground">{h.sub}</p>}
                    </div>
                    <span className="glass-pill shrink-0 text-xs">
                      {h.score >= 0.99 ? "exacto" : `~${Math.round(h.score * 100)}%`}
                    </span>
                  </div>
                );
                return <div key={`${cat}-${h.id}`}>
                  {h.to ? <Link to={h.to}>{inner}</Link> : inner}
                  {cat === "lugares" && <a href={catalogUrl({ place: h.label })} target="_blank" rel="noopener noreferrer" data-external-browser="true" className="inline-flex min-h-11 items-center gap-2 px-3 text-xs font-medium text-primary"><Library className="h-4 w-4" /> Catálogo de este lugar <ExternalLink className="h-3 w-3" /></a>}
                </div>;
              })}
            </div>
          </div>
        )
      ))}
    </div>
  );
}
