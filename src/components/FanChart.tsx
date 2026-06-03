import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { padresDe } from "@/lib/kinship";

type Persona = {
  id: string; nombres: string; apellidos: string; sexo?: string | null;
  nac_fecha?: string | null; defuncion_fecha?: string | null; viva?: string | null;
};
type Rel = { id?: string; persona_id: string; pariente_id: string; tipo: string; notas?: string | null };

const yearOf = (d?: string | null) => (d ? new Date(d).getUTCFullYear() : null);

/**
 * Fan chart: radial ancestor view.
 * - center: probandus at center (gen 0)
 * - gen 1..N: arcs going outward.
 * - color repeats by ancestor role in every branch:
 *   father / paternal ancestor = blue, mother / maternal ancestor = pink.
 */
export default function FanChart({
  personas, rels, centerId, generations = 5, size = 720,
}: { personas: Persona[]; rels: Rel[]; centerId: string; generations?: number; size?: number }) {
  const navigate = useNavigate();
  const byId = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas]);

  // ancestors[gen][index] = personaId | null. index 0..(2^gen - 1).
  // For each person at (gen, idx) -> father at (gen+1, 2*idx), mother at (gen+1, 2*idx+1)
  const ancestors = useMemo(() => {
    const a: (string | null)[][] = [[centerId]];
    for (let g = 1; g <= generations; g++) {
      const prev = a[g - 1];
      const next: (string | null)[] = new Array(prev.length * 2).fill(null);
      prev.forEach((pid, idx) => {
        if (!pid) return;
        const parents = padresDe(pid, rels.map((r, i) => ({ id: r.id ?? `${i}`, ...r })) as any, byId as any);
        const padre = parents.padre?.id ?? null;
        const madre = parents.madre?.id ?? null;
        next[idx * 2] = padre;
        next[idx * 2 + 1] = madre;
      });
      a.push(next);
    }
    return a;
  }, [personas, rels, centerId, generations, byId]);

  const cx = size / 2, cy = size / 2;
  const ringWidth = (size / 2 - 40) / generations;
  const startAngle = -180; // top-left to top-right span; we'll use full 360 splitting top half (ancestors above)
  const totalAngle = 180; // ancestors go in upper semicircle

  const polar = (r: number, angleDeg: number) => {
    const a = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };

  const arcPath = (r1: number, r2: number, a1: number, a2: number) => {
    const p1 = polar(r1, a1), p2 = polar(r2, a1), p3 = polar(r2, a2), p4 = polar(r1, a2);
    const large = a2 - a1 > 180 ? 1 : 0;
    return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} A ${r2} ${r2} 0 ${large} 1 ${p3.x} ${p3.y} L ${p4.x} ${p4.y} A ${r1} ${r1} 0 ${large} 0 ${p1.x} ${p1.y} Z`;
  };

  // Color by role inside every ancestral couple:
  // idx even = father/paternal slot, idx odd = mother/maternal slot.
  // This keeps father-of-father and father-of-mother blue, while
  // mother-of-father and mother-of-mother stay rose.
  const colorFor = (gen: number, idx: number, hasPerson: boolean) => {
    if (gen === 0) return hasPerson ? "hsl(211, 100%, 50%)" : "hsl(220, 16%, 90%)";
    if (!hasPerson) return "hsl(214, 8%, 52%)";
    const paternalSlot = idx % 2 === 0;
    const hue = paternalSlot ? 207 : 335;
    const saturation = paternalSlot ? 82 : 76;
    const lightness = Math.max(43, 73 - gen * 5);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  const fullName = (p?: Persona) => p ? `${p.nombres} ${p.apellidos}`.trim() : "";
  const truncate = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + "…" : s;
  const labelLimit = (gen: number) => Math.max(4, 18 - gen * 2);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="max-w-full" style={{ width: size }}>
      {/* Center (probandus) */}
      {(() => {
        const r = ringWidth - 4;
        const p = byId.get(centerId);
        return (
          <g style={{ cursor: "pointer" }} onClick={() => navigate(`/personas/${centerId}`)}>
            <circle cx={cx} cy={cy} r={r} fill={colorFor(0, 0, true)} stroke="hsl(0 0% 100% / 0.8)" strokeWidth={2} />
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize={11} fontWeight="600" fill="white">
              {truncate(p?.nombres ?? "—", 12)}
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize={10} fill="white" opacity={0.85}>
              {truncate(p?.apellidos ?? "", 14)}
            </text>
          </g>
        );
      })()}

      {/* Ancestor rings */}
      {Array.from({ length: generations }, (_, gi) => {
        const gen = gi + 1;
        const count = Math.pow(2, gen);
        const arc = totalAngle / count;
        const r1 = ringWidth * gen;
        const r2 = ringWidth * (gen + 1);
        return ancestors[gen].map((pid, idx) => {
          const a1 = startAngle + arc * idx;
          const a2 = startAngle + arc * (idx + 1);
          const p = pid ? byId.get(pid) : undefined;
          const mid = (a1 + a2) / 2;
          const midR = (r1 + r2) / 2;
          const tp = polar(midR, mid);
          const fontMain = Math.max(6, 12 - gen);
          const maxName = labelLimit(gen);
          return (
            <g key={`${gen}-${idx}`}
              style={{ cursor: pid ? "pointer" : "default" }}
              onClick={() => pid && navigate(`/personas/${pid}`)}
            >
              <path d={arcPath(r1, r2, a1, a2)}
                fill={colorFor(gen, idx, !!pid)}
                stroke="hsl(0 0% 100% / 0.9)" strokeWidth={1.5}
                opacity={pid ? 1 : 0.5} />
              {p && (
                <g transform={`translate(${tp.x} ${tp.y})`}>
                  <text
                    textAnchor="middle" fontSize={fontMain}
                    fontWeight="600" fill="white" y={-2}
                  >
                    {truncate(p.nombres, maxName)}
                  </text>
                  <text textAnchor="middle" fontSize={Math.max(6, fontMain - 1)} fill="white" opacity={0.85} y={Math.max(8, 11 - gen)}>
                    {truncate(p.apellidos, maxName)}
                  </text>
                  {(yearOf(p.nac_fecha) || yearOf(p.defuncion_fecha)) && (
                    <text textAnchor="middle" fontSize={Math.max(6, 9 - gen)} fill="white" opacity={0.7} y={Math.max(18, 22 - gen)}>
                      {yearOf(p.nac_fecha) ?? "?"}–{yearOf(p.defuncion_fecha) ?? (p.viva === "si" ? "" : "?")}
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        });
      })}
    </svg>
  );
}
