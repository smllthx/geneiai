import { ReactNode, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  GitBranch,
  Lightbulb,
  Loader2,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AgentAction = {
  label: string;
  description?: string;
  to?: string;
  onClick?: () => void | Promise<void>;
  icon?: ReactNode;
  kind?: "primary" | "secondary" | "warning";
  disabled?: boolean;
};

type Metric = {
  label: string;
  value: number | string;
  tone?: "ok" | "warn" | "info" | "neutral";
};

type Props = {
  context?: "dashboard" | "persona" | "documento" | "arbol" | "investigacion";
  title?: string;
  subtitle?: string;
  personName?: string;
  metrics?: Metric[];
  actions?: AgentAction[];
  compact?: boolean;
  className?: string;
};

const defaultActions: Record<NonNullable<Props["context"]>, AgentAction[]> = {
  dashboard: [
    { label: "Revisar tareas IA", to: "/tareas-ia", icon: <ClipboardCheck className="h-4 w-4" /> },
    { label: "Buscar con IA", to: "/investigacion?tab=busqueda", icon: <Search className="h-4 w-4" /> },
    { label: "Ver hipótesis", to: "/hipotesis", icon: <Lightbulb className="h-4 w-4" /> },
  ],
  persona: [
    { label: "Investigar persona", to: "/investigacion?tab=agente", icon: <Bot className="h-4 w-4" /> },
    { label: "Buscar evidencia", to: "/investigacion?tab=busqueda", icon: <FileSearch className="h-4 w-4" /> },
    { label: "Detectar inconsistencias", to: "/inferencias", icon: <ShieldCheck className="h-4 w-4" /> },
  ],
  documento: [
    { label: "Extraer datos", icon: <FileSearch className="h-4 w-4" /> },
    { label: "Crear sugerencias", to: "/sugerencias", icon: <Sparkles className="h-4 w-4" /> },
    { label: "Vincular fuentes", to: "/fuentes", icon: <GitBranch className="h-4 w-4" /> },
  ],
  arbol: [
    { label: "Priorizar ramas débiles", to: "/investigacion?tab=insights", icon: <Route className="h-4 w-4" /> },
    { label: "Buscar duplicados", to: "/fusionar", icon: <ShieldCheck className="h-4 w-4" /> },
    { label: "Tareas del árbol", to: "/tareas-ia", icon: <ClipboardCheck className="h-4 w-4" /> },
  ],
  investigacion: [
    { label: "Agente guiado", to: "/investigacion?tab=agente", icon: <Bot className="h-4 w-4" /> },
    { label: "Agentes paralelos", to: "/investigacion?tab=paralelo", icon: <Sparkles className="h-4 w-4" /> },
    { label: "Importadas pendientes", to: "/importadas-pendientes", icon: <GitBranch className="h-4 w-4" /> },
  ],
};

const statusCopy: Record<NonNullable<Props["context"]>, string> = {
  dashboard: "Prioriza documentos, personas incompletas y tareas pendientes.",
  persona: "Trabaja sobre esta ficha sin aplicar cambios destructivos automáticamente.",
  documento: "Extrae evidencia, nombres y relaciones; tú confirmas antes de vincular.",
  arbol: "Lee el árbol como grafo familiar y propone tareas por rama.",
  investigacion: "Unifica búsqueda, hipótesis, duplicados, agentes y pistas.",
};

function metricTone(tone: Metric["tone"]) {
  if (tone === "ok") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";
  if (tone === "warn") return "border-amber-400/30 bg-amber-500/10 text-amber-100";
  if (tone === "info") return "border-sky-400/30 bg-sky-500/10 text-sky-100";
  return "border-border bg-foreground/5 text-foreground";
}

export default function GenealogistaIA({
  context = "dashboard",
  title = "Genealogista IA",
  subtitle,
  personName,
  metrics = [],
  actions,
  compact = false,
  className,
}: Props) {
  const navigate = useNavigate();
  const [running, setRunning] = useState<string | null>(null);
  const mergedActions = useMemo(() => actions?.length ? actions : defaultActions[context], [actions, context]);
  const detail = subtitle ?? statusCopy[context];

  const runAction = async (action: AgentAction) => {
    if (action.disabled) return;
    if (action.to) {
      navigate(action.to);
      return;
    }
    if (!action.onClick) return;
    setRunning(action.label);
    try {
      await action.onClick();
    } finally {
      setRunning(null);
    }
  };

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-cyan-300/20 bg-[linear-gradient(135deg,hsl(var(--card))_0%,hsl(var(--background))_62%,hsl(var(--primary)/0.12)_100%)] p-4 shadow-sm",
        compact ? "p-4" : "p-5",
        className,
      )}
      aria-label="Genealogista IA"
    >
      <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary/15 text-primary">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Cerebro de investigación</p>
              <h2 className="font-display text-xl font-semibold leading-tight">{title}</h2>
            </div>
            <Badge variant="outline" className="border-cyan-300/30 bg-cyan-300/10 text-[10px] text-cyan-100">
              Confirmación humana
            </Badge>
          </div>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            {personName ? <>Contexto activo: <strong className="text-foreground">{personName}</strong>. </> : null}
            {detail}
          </p>
          {!compact && (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2.5 py-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Hechos confirmados
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2.5 py-1">
                <Lightbulb className="h-3.5 w-3.5 text-amber-400" /> Hipótesis revisables
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2.5 py-1">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-400" /> Conflictos marcados
              </span>
            </div>
          )}
        </div>

        {metrics.length > 0 && (
          <div className="grid min-w-[min(100%,360px)] grid-cols-2 gap-2 sm:grid-cols-3">
            {metrics.map((metric) => (
              <div key={metric.label} className={cn("rounded-2xl border px-3 py-2", metricTone(metric.tone))}>
                <div className="font-display text-2xl font-bold leading-none">{metric.value}</div>
                <div className="mt-1 text-[11px] leading-tight opacity-80">{metric.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {mergedActions.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={action.disabled || running === action.label}
            onClick={() => runAction(action)}
            className={cn(
              "group flex min-h-16 items-start gap-3 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:bg-foreground/5 disabled:pointer-events-none disabled:opacity-60",
              action.kind === "primary" ? "border-primary/40 bg-primary/10" : "border-border/70 bg-background/40",
              action.kind === "warning" && "border-amber-400/30 bg-amber-400/10",
            )}
          >
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-foreground/5 text-primary transition group-hover:bg-primary/15">
              {running === action.label ? <Loader2 className="h-4 w-4 animate-spin" /> : action.icon ?? <Sparkles className="h-4 w-4" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-tight">{action.label}</span>
              {action.description && <span className="mt-1 block text-xs leading-snug text-muted-foreground">{action.description}</span>}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
