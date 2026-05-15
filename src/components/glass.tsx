import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlassCard({
  children, className, padded = true, interactive = false,
}: { children: ReactNode; className?: string; padded?: boolean; interactive?: boolean }) {
  return (
    <div
      className={cn(
        "glass rounded-3xl",
        padded && "p-5",
        interactive && "transition-all hover:scale-[1.01] hover:shadow-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  eyebrow, title, subtitle, actions,
}: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  icon, title, description, action,
}: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <GlassCard className="text-center" padded>
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-8">
        {icon && <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/5">{icon}</div>}
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        {action}
      </div>
    </GlassCard>
  );
}

export function StatPill({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <GlassCard className="overflow-hidden" padded>
      <div className="font-display text-3xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-sm font-medium text-foreground/80">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </GlassCard>
  );
}
