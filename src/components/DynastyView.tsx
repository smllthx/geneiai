import { lifeDates } from "@/lib/personDates";
import PersonPortrait from "@/components/PersonPortrait";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { padresDe } from "@/lib/kinship";
import { familyLayers } from "@/lib/treeRendering";

type Persona = {
  id: string; nombres: string; apellidos: string; sexo?: string | null; foto_url?: string | null;
  nac_fecha_aprox?: string | null; nac_rango_ini?: number | null; nac_rango_fin?: number | null;
  nac_fecha?: string | null; defuncion_fecha?: string | null; viva?: string | null;
};
type Rel = { persona_id: string; pariente_id: string; tipo: string };


/**
 * Dynastic / generational horizontal view: each generation = a horizontal strip.
 * Probandus at bottom, ancestors going up. Connected with subtle SVG lines.
 */
export default function DynastyView({
  personas, rels, centerId, generations = 4,
}: { personas: Persona[]; rels: Rel[]; centerId: string; generations?: number }) {
  const navigate = useNavigate();
  const byId = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas]);

  const normalizedRels = useMemo(() => rels.map((r, i) => ({ ...r, id: String(i) })), [rels]);
  const layers = useMemo(() => familyLayers(centerId, generations, (pid) => {
    const parents = padresDe(pid, normalizedRels, byId);
    return [parents.padre?.id ?? null, parents.madre?.id ?? null];
  }), [normalizedRels, centerId, generations, byId]);

  const renderCard = (pid: string, gen: number, idx: number, rootSide: number) => {
    const p = pid ? byId.get(pid) : undefined;
    const isPaternal = gen === 0 ? null : rootSide === 0;
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
        key={`${gen}-${idx}-${pid}`}
        onClick={() => navigate(`/personas/${pid}`)}
        className={`glass min-w-[110px] max-w-[150px] rounded-xl ring-2 ${borderColor} ${bg} px-2 py-1.5 text-left transition-all hover:scale-[1.04]`}
      >
        <PersonPortrait person={p} className="mb-1 h-9 w-9 rounded-full" />
        <div className="truncate text-[11px] font-semibold leading-tight">{p.nombres}</div>
        <div className="truncate text-[10px] text-foreground/80">{p.apellidos}</div>
        {lifeDates(p) && (
          <div className="mt-0.5 text-[9px] text-muted-foreground">
            {lifeDates(p)}
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
            {layer.map((node, idx) => renderCard(node.id, gen, idx, node.rootSide))}
          </div>
        </div>
      ))}
    </div>
  );
}
