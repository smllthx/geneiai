import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, Sparkles } from "lucide-react";
import { expandTerm, fuzzyScore, norm } from "@/lib/search/fuzzy";

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

export default function Buscar() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [expansionInfo, setExpansionInfo] = useState<string[]>([]);

  useEffect(() => {
    if (!q || q.length < 2) { setHits([]); setExpansionInfo([]); return; }
    setParams({ q }, { replace: true });
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

        for (const r of p.data ?? []) {
          const variantes = (r.variantes_nombre ?? []).join(" ");
          const text = `${r.nombres} ${r.apellidos} ${variantes} ${r.notas ?? ""}`;
          const score = fuzzyScore(q, text);
          if (score >= 0.7) all.push({
            id: r.id, cat: "personas", label: `${r.nombres} ${r.apellidos}`.trim(),
            sub: variantes ? `también: ${variantes}` : undefined,
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
  }, [q]); // eslint-disable-line

  const grouped = useMemo(() => {
    const g: Record<Cat, Hit[]> = { personas: [], documentos: [], eventos: [], hipotesis: [], lugares: [] };
    hits.forEach((h) => g[h.cat].push(h));
    return g;
  }, [hits]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Búsqueda universal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tolera errores de tipeo, variantes ortográficas, traducciones y nombres equivalentes
          (Giovanni ↔ Juan ↔ John, Sanguineti ↔ Sanguinetti, etc.).
        </p>
      </div>

      <div className="glass-strong flex items-center gap-2 rounded-2xl px-4 py-3">
        <Search className="h-5 w-5 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar en todo el archivo: nombres, apellidos, lugares, palabras dentro de actas…"
          className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

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
