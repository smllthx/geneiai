import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Lightbulb, Sparkles, Compass, TrendingUp, AlertCircle, ChevronRight, RefreshCw } from "lucide-react";

type Stats = {
  sugerenciasPendientes: number;
  hipotesis: number;
  coincidencias: number;
  ramaIncompleta: { label: string; faltan: number } | null;
  ultimaWeb: { titulo: string; url: string } | null;
};

export default function TreeInsights({ personaId, personaNombre }: { personaId: string; personaNombre: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!personaId) return;
    (async () => {
      const [sugs, hips, coins] = await Promise.all([
        supabase.from("sugerencias").select("id,titulo,url_externa,tipo_externo,origen", { count: "exact" })
          .eq("persona_id", personaId).eq("estado", "pendiente").order("created_at", { ascending: false }).limit(5),
        supabase.from("hipotesis").select("id", { count: "exact", head: true }).contains("personas", [personaId]).eq("estado", "abierta"),
        supabase.from("coincidencias").select("id", { count: "exact", head: true }).or(`ref_a.eq.${personaId},ref_b.eq.${personaId}`),
      ]);
      const ultimaWeb = (sugs.data ?? []).find((s: any) => s.origen === "web-search-libre");
      setStats({
        sugerenciasPendientes: sugs.count ?? 0,
        hipotesis: hips.count ?? 0,
        coincidencias: coins.count ?? 0,
        ramaIncompleta: null,
        ultimaWeb: ultimaWeb ? { titulo: ultimaWeb.titulo, url: ultimaWeb.url_externa } : null,
      });
    })();
  }, [personaId, refreshTick]);

  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ personId?: string }>).detail;
      if (!detail?.personId || detail.personId === personaId) setRefreshTick((n) => n + 1);
    };
    window.addEventListener("genaia:smart-insights-refresh", refresh);
    window.addEventListener("genaia:data-changed", refresh);
    return () => {
      window.removeEventListener("genaia:smart-insights-refresh", refresh);
      window.removeEventListener("genaia:data-changed", refresh);
    };
  }, [personaId]);

  if (!stats) return null;
  const cards = [
    { icon: Lightbulb, label: "Sugerencias por revisar", value: stats.sugerenciasPendientes, to: "/investigacion", tint: "from-amber-500/15 to-amber-500/0", color: "text-amber-600 dark:text-amber-400" },
    { icon: Sparkles, label: "Hipótesis abiertas", value: stats.hipotesis, to: "/hipotesis", tint: "from-violet-500/15 to-violet-500/0", color: "text-violet-600 dark:text-violet-400" },
    { icon: Compass, label: "Coincidencias", value: stats.coincidencias, to: "/coincidencias", tint: "from-sky-500/15 to-sky-500/0", color: "text-sky-600 dark:text-sky-400" },
  ];

  const total = stats.sugerenciasPendientes + stats.hipotesis + stats.coincidencias;
  if (total === 0 && !stats.ultimaWeb) return null;

  return (
    <div className="mx-3 mb-3 md:mx-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Insights · {personaNombre}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshTick((n) => n + 1)}
          className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-[10px] font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary"
          title="Actualizar insights del árbol"
        >
          <RefreshCw className="h-3 w-3" />
          Actualizar
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className={`group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br ${c.tint} p-3 transition-all hover:scale-[1.02] hover:border-primary/40`}>
            <c.icon className={`mb-1 h-4 w-4 ${c.color}`} />
            <div className="font-display text-xl font-bold leading-none">{c.value}</div>
            <div className="mt-1 text-[10px] leading-tight text-muted-foreground">{c.label}</div>
          </Link>
        ))}
      </div>
      {stats.ultimaWeb && (
        <a href={stats.ultimaWeb.url ?? "#"} target="_blank" rel="noreferrer"
          className="mt-2 flex items-center gap-2 rounded-2xl border border-border/60 bg-card/60 p-2.5 text-xs transition-all hover:border-primary/40">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-foreground/80">Hallazgo web reciente: <strong>{stats.ultimaWeb.titulo}</strong></span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </a>
      )}
    </div>
  );
}
