import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, FileText, HelpCircle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EvidenceItem = {
  id?: string;
  title: string;
  detail?: string;
  status?: "confirmado" | "probable" | "dudoso" | "descartado" | string | null;
  source?: string;
  to?: string;
};

type Props = {
  title?: string;
  items?: EvidenceItem[];
  sourceCount?: number;
  eventCount?: number;
  hypothesisCount?: number;
  compact?: boolean;
  className?: string;
};

const statusMeta = (status?: EvidenceItem["status"]) => {
  if (status === "confirmado" || status === "verificado") return { label: "Confirmado", icon: CheckCircle2, cls: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" };
  if (status === "dudoso") return { label: "Dudoso", icon: AlertTriangle, cls: "border-amber-400/30 bg-amber-500/10 text-amber-100" };
  if (status === "descartado") return { label: "Descartado", icon: AlertTriangle, cls: "border-rose-400/30 bg-rose-500/10 text-rose-100" };
  return { label: "Probable", icon: HelpCircle, cls: "border-sky-400/30 bg-sky-500/10 text-sky-100" };
};

export default function EvidenceCenter({
  title = "Centro de evidencias",
  items = [],
  sourceCount = 0,
  eventCount = 0,
  hypothesisCount = 0,
  compact = false,
  className,
}: Props) {
  const visible = items.slice(0, compact ? 3 : 6);

  return (
    <section className={cn("rounded-3xl border border-border bg-card/70 p-4 shadow-sm", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Evidencia y confianza</p>
          <h2 className="mt-1 flex items-center gap-2 font-display text-lg font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" /> {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Cada dato relevante debe quedar conectado a una fuente, documento, explicación y estado de confianza.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-2xl bg-foreground/5 px-3 py-2"><strong className="block text-lg">{sourceCount}</strong>Fuentes</div>
          <div className="rounded-2xl bg-foreground/5 px-3 py-2"><strong className="block text-lg">{eventCount}</strong>Eventos</div>
          <div className="rounded-2xl bg-foreground/5 px-3 py-2"><strong className="block text-lg">{hypothesisCount}</strong>Hipótesis</div>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Todavía no hay evidencia detallada para mostrar. Vincula documentos o fuentes desde la ficha.
          </div>
        ) : visible.map((item, idx) => {
          const meta = statusMeta(item.status);
          const Icon = meta.icon;
          const content = (
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/40 p-3 transition hover:bg-foreground/5">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-foreground/5">
                <FileText className="h-4 w-4 text-primary" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <Badge variant="outline" className={cn("gap-1 text-[10px]", meta.cls)}>
                    <Icon className="h-3 w-3" /> {meta.label}
                  </Badge>
                </div>
                {item.detail && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.detail}</p>}
                {item.source && <p className="mt-1 text-[11px] text-muted-foreground">Fuente: {item.source}</p>}
              </div>
            </div>
          );
          return item.to ? <Link key={item.id ?? idx} to={item.to}>{content}</Link> : <div key={item.id ?? idx}>{content}</div>;
        })}
      </div>

      {!compact && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/documentos">Administrar documentos</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/fuentes">Administrar fuentes</Link>
          </Button>
        </div>
      )}
    </section>
  );
}
