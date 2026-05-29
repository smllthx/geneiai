import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Building2, Camera, Cross, FileSearch, Image, Library, Loader2, Map, Search, Sparkles, Trees, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { expandTerm, fuzzyScore, norm } from "@/lib/search/fuzzy";
import { personaCode, matchesCode, normalizeCode } from "@/lib/personaCode";
import PersonaName from "@/components/PersonaName";

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

export default function Buscar() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [expansionInfo, setExpansionInfo] = useState<string[]>([]);
  const [mode, setMode] = useState(params.get("modo") ?? "registros");

  useEffect(() => {
    if (!q || q.length < 2) { setHits([]); setExpansionInfo([]); return; }
    setParams({ q, modo: mode }, { replace: true });
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        // 1. Expandir el término (variantes/traducciones/typos)
        const expansions = q.split(/\s+/).flatMap(expandTerm);
        const uniqueExp = [...new Set(expansions)].filter((e) => e.length >= 2);
        setExpansionInfo(uniqueExp.filter((e) => e !== norm(q)));

        // 2. Pull amplio (sin filtros) y rankear en cliente — robusto frente a typos
        const [p, d, e, h, l] = await Promise.all([
          supabase.from("personas").select("id, nombres, apellidos, variantes_nombre, notas").limit(1000),
          supabase.from("documentos").select("id, titulo, tipo, transcripcion, resumen, ocr_texto").limit(1000),
          supabase.from("eventos").select("id, tipo, descripcion, lugar_original, persona_id").limit(1000),
          supabase.from("hipotesis").select("id, titulo, descripcion").limit(500),
          supabase.from("lugares").select("id, ciudad, provincia, region, pais, parroquia").limit(1000),
        ]);

        const all: Hit[] = [];

        // Detectar si el query parece un código de identificación (GDVB-TS5)
        const codeNorm = normalizeCode(q);
        const looksLikeCode = /^[A-Z2-9]{2,}-?[A-Z2-9]*$/i.test(q.trim()) && codeNorm.length >= 3;

        for (const r of p.data ?? []) {
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
        for (const r of d.data ?? []) {
          const text = `${r.titulo} ${r.resumen ?? ""} ${r.transcripcion ?? ""} ${r.ocr_texto ?? ""}`;
          const score = fuzzyScore(q, text);
          if (score >= 0.7) all.push({
            id: r.id, cat: "documentos", label: r.titulo, sub: r.tipo,
            score, to: `/documentos/${r.id}`,
          });
        }
        for (const r of e.data ?? []) {
          const text = `${r.tipo} ${r.descripcion ?? ""} ${r.lugar_original ?? ""}`;
          const score = fuzzyScore(q, text);
          if (score >= 0.7) all.push({
            id: r.id, cat: "eventos", label: `${r.tipo}: ${r.descripcion ?? r.lugar_original ?? ""}`,
            score, to: r.persona_id ? `/personas/${r.persona_id}` : undefined,
          });
        }
        for (const r of h.data ?? []) {
          const text = `${r.titulo} ${r.descripcion ?? ""}`;
          const score = fuzzyScore(q, text);
          if (score >= 0.7) all.push({
            id: r.id, cat: "hipotesis", label: r.titulo, sub: r.descripcion?.slice(0, 80),
            score, to: `/hipotesis`,
          });
        }
        for (const r of l.data ?? []) {
          const parts = [r.parroquia, r.ciudad, r.provincia, r.region, r.pais].filter(Boolean);
          const text = parts.join(" ");
          const score = fuzzyScore(q, text);
          if (score >= 0.7) all.push({
            id: r.id, cat: "lugares", label: parts.join(", "),
            score, to: `/lugares`,
          });
        }

        all.sort((a, b) => b.score - a.score);
        setHits(all.slice(0, 100));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, mode]); // eslint-disable-line

  const grouped = useMemo(() => {
    const g: Record<Cat, Hit[]> = { personas: [], documentos: [], eventos: [], hipotesis: [], lugares: [] };
    hits.forEach((h) => g[h.cat].push(h));
    return g;
  }, [hits]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Investigación y búsqueda</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Hub de búsqueda genealógica: registros, texto completo, imágenes, árbol, genealogías, catálogo, libros, wiki y cementerios.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SEARCH_MODES.map(({ key, label, icon: Icon, desc }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={`rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${mode === key ? "border-primary bg-primary/5" : "bg-card"}`}
          >
            <Icon className="mb-2 h-5 w-5 text-primary" />
            <p className="font-medium">{label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="glass-card p-4">
          <p className="mb-3 text-sm font-semibold">Formulario {SEARCH_MODES.find((m) => m.key === mode)?.label}</p>
          <div className="grid gap-2 sm:grid-cols-4">
            <input className="rounded-xl border bg-background px-3 py-2 text-sm outline-none" placeholder="Nombres" />
            <input className="rounded-xl border bg-background px-3 py-2 text-sm outline-none" placeholder="Apellidos" />
            <input className="rounded-xl border bg-background px-3 py-2 text-sm outline-none" placeholder="Lugar" />
            <input className="rounded-xl border bg-background px-3 py-2 text-sm outline-none" placeholder="Año aprox." />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm"><Search className="h-4 w-4" /> Buscar</Button>
            <Button size="sm" variant="outline">Más opciones</Button>
            <Button size="sm" variant="outline"><Sparkles className="h-4 w-4" /> Buscar con IA</Button>
          </div>
        </div>
        <div className="glass-card p-4">
          <p className="font-semibold">Asistente de consulta IA</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Sugiere variantes ortográficas, lugares cercanos, rangos de fechas y búsquedas paralelas según la persona o apellido.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            <span className="glass-pill">Sanguineti / Sanguinetti</span>
            <span className="glass-pill">Aeschlimann / Eschlimann</span>
            <span className="glass-pill">Chile / Italia / Suiza</span>
          </div>
        </div>
      </div>

      <div className="glass-strong flex items-center gap-2 rounded-2xl px-4 py-3">
        <Search className="h-5 w-5 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, apellido, código (ej. GDVB-TS5), lugar, palabra en acta…"
          className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
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

      {q.length >= 2 && hits.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground">Sin coincidencias, ni siquiera aproximadas.</p>
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
                    <span className="glass-pill text-xs">
                      {h.score >= 0.99 ? "exacto" : `~${Math.round(h.score * 100)}%`}
                    </span>
                  </div>
                );
                return h.to ? <Link key={`${cat}-${h.id}`} to={h.to}>{inner}</Link> : <div key={`${cat}-${h.id}`}>{inner}</div>;
              })}
            </div>
          </div>
        )
      ))}
    </div>
  );
}
