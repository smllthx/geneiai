import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PersonPortrait from "@/components/PersonPortrait";
import type { PersonaLite } from "@/components/PersonCard";
import { padresDe, type RelRow } from "@/lib/kinship";
import { ancestorLayers } from "@/lib/treeRendering";

const FONT_SIZE = 14;
const LINE_HEIGHT = 17;
const PHOTO = 30;
const GAP = 7;

type FanPerson = PersonaLite & { caption?: string };

function makeLabel(person: FanPerson, measure: (line: string) => number) {
  const lines: string[] = [];
  for (const part of [person.nombres, person.apellidos]) {
    let line = "";
    for (const word of (part || "").trim().split(/\s+/).filter(Boolean)) {
      if (line && measure(line + " " + word) > 118) {
        lines.push(line);
        line = "";
      }
      line = line ? line + " " + word : word;
    }
    if (line) lines.push(line);
  }
  if (!lines.length) lines.push("Sin nombre");
  const birth = person.nac_fecha?.match(/\d{4}/)?.[0] ?? person.nac_rango_ini;
  const death = person.defuncion_fecha?.match(/\d{4}/)?.[0];
  const dates = person.caption ?? (birth || death ? `${birth ?? "?"}–${death ?? (person.viva === "si" ? "" : "?")}` : "");
  const textWidth = Math.max(...lines.map(measure), measure(dates));
  return {
    person, lines, dates, textWidth,
    width: PHOTO + GAP + textWidth,
    height: Math.max(PHOTO, (lines.length + Number(Boolean(dates))) * LINE_HEIGHT),
  };
}

type Label = ReturnType<typeof makeLabel>;

function layoutFan(layers: (FanPerson | undefined)[][]) {
  // Use the same stable font for geometry and for drawing; no reflow when app fonts load.
  const ctx = typeof CanvasRenderingContext2D !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  if (ctx) ctx.font = `600 ${FONT_SIZE}px Arial`;
  const measure = (s: string) => ctx ? Math.ceil(ctx.measureText(s).width) : [...s].length * FONT_SIZE;
  const labels = layers.map(layer => layer.map(person => person && makeLabel(person, measure)));
  const center = labels[0]?.[0];
  const centerRadius = center ? Math.hypot(center.width, center.height) / 2 + GAP : 55;
  let radius = centerRadius + 2;
  const rings = labels.slice(1).map((slots, index) => {
    const inner = radius;
    const step = Math.PI / slots.length;
    // Outer labels follow their radii, so a double surname has room even in a 64-slot ring.
    const radial = index >= 3;
    let labelRadius = inner + GAP;
    let thickness = 0;
    let breadth = 0;
    for (const label of slots) {
      if (!label) continue;
      thickness = Math.max(thickness, radial ? label.width : label.height);
      breadth = Math.max(breadth, radial ? label.height : label.width);
    }
    // The nearest label corners must clear both sides of the wedge as well as its inner arc.
    labelRadius = Math.max(labelRadius, (breadth / 2 + GAP) / Math.tan(step / 2)) + thickness / 2;
    radius = Math.hypot(labelRadius + thickness / 2, breadth / 2) + GAP;
    return { slots, inner, outer: radius, step, labelRadius, radial };
  });
  return { center, centerRadius, rings, radius: radius + 4 };
}

function FanLabel({ label, x, y, rotate = 0 }: { label: Label; x: number; y: number; rotate?: number }) {
  const { person, lines, dates, width, height } = label;
  const name = [person.nombres, person.apellidos].filter(Boolean).join(" ");
  return <g transform={`translate(${x},${y}) rotate(${rotate})`} aria-hidden="true" pointerEvents="none">
    <foreignObject x={-width / 2} y={-PHOTO / 2} width={PHOTO} height={PHOTO}>
      <PersonPortrait personId={person.id} src={person.foto_url} name={name} className="h-full w-full rounded-full bg-white/90 object-cover text-slate-800" />
    </foreignObject>
    <text fill="white" textRendering="geometricPrecision" fontFamily="Arial, sans-serif" fontSize={FONT_SIZE} fontWeight="600">
      {lines.map((line, i) => <tspan key={i} x={-width / 2 + PHOTO + GAP} y={-height / 2 + FONT_SIZE + i * LINE_HEIGHT}>{line}</tspan>)}
      {dates && <tspan x={-width / 2 + PHOTO + GAP} y={-height / 2 + FONT_SIZE + lines.length * LINE_HEIGHT} fontWeight="400" fontSize={12}>{dates}</tspan>}
    </text>
  </g>;
}

type FanChartProps = {
  personas: FanPerson[];
  rels: RelRow[];
  centerId: string;
  generations?: number;
  onSelect?: (id: string) => void;
};

export default function FanChart({ personas, rels, centerId, generations = 5, onSelect }: FanChartProps) {
  const navigate = useNavigate();
  const { center, centerRadius, rings, radius } = useMemo(() => {
    const byId = new Map(personas.map(p => [p.id, p]));
    const layers = ancestorLayers(centerId, generations, id => {
      const { padre, madre } = padresDe(id, rels, byId);
      return [padre?.id ?? null, madre?.id ?? null];
    });
    return layoutFan(layers.map(layer => layer.map(id => id ? byId.get(id) : undefined)));
  }, [personas, rels, centerId, generations]);

  function personControl(label: Label) {
    const { id, nombres, apellidos } = label.person;
    const open = () => onSelect ? onSelect(id) : navigate(`/personas/${id}`);
    return {
      role: "button", tabIndex: 0, "aria-label": [nombres, apellidos].filter(Boolean).join(" ") || "Sin nombre",
      className: "cursor-pointer focus-visible:outline focus-visible:outline-primary", onClick: open,
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
      },
    };
  }

  const point = (r: number, a: number) => `${r * Math.cos(a)} ${r * Math.sin(a)}`;
  return <svg width={radius * 2} height={radius + centerRadius + 4}
    viewBox={`${-radius} ${-radius} ${radius * 2} ${radius + centerRadius + 4}`}
    role="group" aria-label="Abanico de antepasados" className="block max-w-none">
    {rings.map(({ slots, inner, outer, step, labelRadius, radial }, depth) => slots.map((label, i) => {
      const start = -Math.PI + i * step;
      const end = start + step;
      const mid = start + step / 2;
      const degrees = mid * 180 / Math.PI;
      const rotate = radial ? (degrees < -90 ? degrees + 180 : degrees) : degrees + 90;
      return <g key={`${depth}-${i}`} {...(label ? personControl(label) : { "aria-hidden": true })}>
        <path d={`M ${point(inner, start)} L ${point(outer, start)} A ${outer} ${outer} 0 0 1 ${point(outer, end)} L ${point(inner, end)} A ${inner} ${inner} 0 0 0 ${point(inner, start)} Z`}
          fill={label ? (i % 2 ? "#a73367" : "#256387") : "hsl(var(--muted))"} stroke="hsl(var(--background))" strokeWidth={2} />
        {label && <FanLabel label={label} x={labelRadius * Math.cos(mid)} y={labelRadius * Math.sin(mid)} rotate={rotate} />}
      </g>;
    }))}
    {center && <g {...personControl(center)}>
      <circle r={centerRadius} fill="#2451a0" stroke="hsl(var(--background))" strokeWidth={2} />
      <FanLabel label={center} x={0} y={0} />
    </g>}
  </svg>;
}
