import { useNavigate } from "react-router-dom";
import { useMemo } from "react";

type Persona = {
  id: string; nombres: string; apellidos: string; sexo?: string | null;
  nac_fecha?: string | null; defuncion_fecha?: string | null; viva?: string | null;
};
type Rel = { persona_id: string; pariente_id: string; tipo: string };

const yearOf = (d?: string | null) => (d ? new Date(d).getUTCFullYear() : null);

/**
 * Dynastic / generational horizontal view: each generation = a horizontal strip.
 * Probandus at bottom, ancestors going up. Connected with subtle SVG lines.
 */
export default function DynastyView({
  personas, rels, centerId, generations = 4,
}: { personas: Persona[]; rels: Rel[]; centerId: string; generations?: number }) {
  const navigate = useNavigate();
  const byId = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas]);

  const layers = useMemo(() => {
    const out: (string | null)[][] = [[centerId]];
    for (let g = 1; g <= generations; g++) {
      const prev = out[g - 1];
      const next: (string | null)[] = [];
      prev.forEach((pid) => {
        if (!pid) { next.push(null, null); return; }
        const padres = rels
          .filter((r) => r.persona_id === pid && (r.tipo === "padre" || r.tipo === "madre"))
          .map((r) => ({ id: r.pariente_id, tipo: r.tipo, sexo: byId.get(r.pariente_id)?.sexo }));
        const padre = padres.find((x) => x.tipo === "padre" || x.sexo === "masculino")?.id ?? null;
        const madre = padres.find((x) => x.tipo === "madre" || x.sexo === "femenino")?.id ?? null;
        next.push(padre, madre);
      });
      out.push(next);
    }
    return out;
  }, [personas, rels, centerId, generations, byId]);

  const renderCard = (pid: string | null, gen: number, idx: number) => {
    const p = pid ? byId.get(pid) : undefined;
    const isPaternal = gen === 0 ? null : idx < layers[gen].length / 2;
    const borderColor = gen === 0
      ? "ring-primary/70"
      : isPaternal ? "ring-sky-400/50" : "ring-pink-400/50";
    const bg = gen === 0
      ? "bg-primary/15"
      : isPaternal ? "bg-sky-500/10" : "bg-pink-500/10";

    if (!p) {
      return (
        <div key={`empty-${gen}-${idx}`} className="glass rounded-xl border-dashed px-2 py-1.5 text-[10px] text-muted-foreground min-w-[90px] max-w-[120px] text-center opacity-60">
          —
        </div>
      );
    }
    return (
      <button
        key={pid}
        onClick={() => navigate(`/personas/${pid}`)}
        className={`glass min-w-[110px] max-w-[150px] rounded-xl ring-2 ${borderColor} ${bg} px-2 py-1.5 text-left transition-all hover:scale-[1.04]`}
      >
        <div className="truncate text-[11px] font-semibold leading-tight">{p.nombres}</div>
        <div className="truncate text-[10px] text-foreground/80">{p.apellidos}</div>
        {(yearOf(p.nac_fecha) || yearOf(p.defuncion_fecha)) && (
          <div className="mt-0.5 text-[9px] text-muted-foreground">
            {yearOf(p.nac_fecha) ?? "?"}–{yearOf(p.defuncion_fecha) ?? (p.viva === "si" ? "vive" : "?")}
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col-reverse gap-6">
      {layers.map((layer, gen) => (
        <div key={gen} className="flex flex-col items-center gap-1">
          {gen > 0 && (
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Generación {gen}
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            {layer.map((pid, idx) => renderCard(pid, gen, idx))}
          </div>
        </div>
      ))}
    </div>
  );
}
