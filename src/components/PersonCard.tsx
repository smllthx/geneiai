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
  defuncion_fecha?: string | null;
  viva?: string | null;
};

export function PersonCard({
  p, highlighted, compact, onClick,
}: { p: PersonaLite; highlighted?: boolean; compact?: boolean; onClick?: () => void }) {
  const navigate = useNavigate();
  const yN = yearOf(p.nac_fecha) ?? p.nac_rango_ini ?? null;
  const yD = yearOf(p.defuncion_fecha) ?? null;
  const lifespan = yN || yD ? `${yN ?? "?"} – ${yD ?? (p.viva === "si" ? "vive" : "?")}` : "—";
  const sexo = p.sexo === "femenino" ? "♀" : p.sexo === "masculino" ? "♂" : "";
  const ringColor =
    p.sexo === "femenino" ? "ring-pink-400/40"
    : p.sexo === "masculino" ? "ring-sky-400/40"
    : "ring-foreground/15";

  return (
    <button
      onClick={onClick ?? (() => navigate(`/personas/${p.id}`))}
      className={cn(
        "glass group flex items-center gap-3 rounded-2xl px-3 py-2 text-left transition-all hover:scale-[1.02] hover:shadow-lg",
        compact ? "min-w-[140px] max-w-[180px]" : "min-w-[160px] max-w-[220px]",
        highlighted && "ring-2 ring-primary/60",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/5 ring-2",
          ringColor,
        )}
      >
        <User className="h-5 w-5 text-foreground/60" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-sm font-semibold leading-tight">
          {p.nombres} {p.apellidos}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{lifespan}</span>
          {sexo && <span className="opacity-60">{sexo}</span>}
        </div>
      </div>
    </button>
  );
}

export function EmptySlot({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="glass flex min-w-[140px] items-center gap-2 rounded-2xl border-dashed px-3 py-2 text-left text-xs text-muted-foreground transition-all hover:border-primary/40 hover:text-primary"
    >
      <UserPlus className="h-4 w-4" />
      <span>Agregar {label}</span>
    </button>
  );
}
