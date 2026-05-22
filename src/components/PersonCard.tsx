import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { User, UserPlus } from "lucide-react";

const yearOf = (d?: string | null) => (d ? new Date(d).getUTCFullYear() : null);

export type PersonaLite = {
  id: string;
  nombres: string;
  apellidos: string;
  sexo?: string | null;
  nac_fecha?: string | null;
  nac_rango_ini?: number | null;
  nac_lugar?: string | null;
  defuncion_fecha?: string | null;
  defuncion_lugar?: string | null;
  viva?: string | null;
  ocupacion?: string | null;
  foto_url?: string | null;
};

function completeness(p: PersonaLite): number {
  const keys: (keyof PersonaLite)[] = [
    "nombres", "apellidos", "sexo", "nac_fecha", "nac_lugar",
    "defuncion_fecha", "ocupacion",
  ];
  const filled = keys.filter((k) => {
    const v = p[k];
    return v !== null && v !== undefined && String(v).trim() !== "";
  }).length;
  return filled / keys.length;
}

export const PersonCard = memo(function PersonCard({
  p, highlighted, directLine, compact, onClick,
}: {
  p: PersonaLite;
  highlighted?: boolean;
  directLine?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  const navigate = useNavigate();
  const yN = yearOf(p.nac_fecha) ?? p.nac_rango_ini ?? null;
  const yD = yearOf(p.defuncion_fecha) ?? null;
  const lifespan = yN || yD ? `${yN ?? "?"}–${yD ?? (p.viva === "si" ? "Vive" : "?")}` : "—";
  const isF = p.sexo === "femenino";
  const isM = p.sexo === "masculino";
  // FamilySearch-style colored top bar
  const topBar = isF ? "bg-pink-400" : isM ? "bg-sky-400" : "bg-foreground/20";
  const avatarBg = isF ? "bg-pink-100 dark:bg-pink-950/40" : isM ? "bg-sky-100 dark:bg-sky-950/40" : "bg-foreground/5";
  const avatarFg = isF ? "text-pink-600 dark:text-pink-300" : isM ? "text-sky-600 dark:text-sky-300" : "text-foreground/50";
  const pct = Math.round(completeness(p) * 100);

  return (
    <button
      onClick={onClick ?? (() => navigate(`/personas/${p.id}`))}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/60 bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        compact ? "w-[140px]" : "w-[164px]",
        highlighted && "ring-2 ring-primary",
        directLine && "ring-2 ring-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]",
      )}
    >
      <div className={cn("h-1.5 w-full", topBar)} />
      <div className="flex flex-col items-center px-2 pb-2 pt-2.5">
        <div className={cn("mb-1.5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full ring-2 ring-white/70 dark:ring-foreground/10", avatarBg)}>
          {p.foto_url ? (
            <img src={p.foto_url} alt={`${p.nombres} ${p.apellidos}`} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <User className={cn("h-7 w-7", avatarFg)} />
          )}
        </div>
        <div className="line-clamp-2 w-full text-center font-display text-[13.5px] font-extrabold leading-tight tracking-tight">
          <span className="gen-name">{p.nombres}</span> <span className="gen-surname">{p.apellidos}</span>
        </div>
        <div className="mt-1 text-[11px] font-semibold tabular-nums text-muted-foreground">{lifespan}</div>
        <div className="mt-1.5 flex w-full items-center gap-1">
          <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                pct >= 70 ? "bg-emerald-500/70" : pct >= 40 ? "bg-amber-500/70" : "bg-foreground/25",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </button>
  );
});

export function EmptySlot({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-[140px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card/40 px-2 py-3 text-[11px] text-muted-foreground transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground/5">
        <UserPlus className="h-4 w-4" />
      </div>
      <span>Agregar {label}</span>
    </button>
  );
}
