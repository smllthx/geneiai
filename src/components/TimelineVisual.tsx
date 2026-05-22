import { useMemo } from "react";
import { Baby, Church, Heart, Cross, MapPin, Briefcase, Plane, FileText, Sparkles } from "lucide-react";

type Item = { fecha: string; label: string; tipo?: string; lugar?: string };

const ICONS: Record<string, any> = {
  nacimiento: Baby,
  bautismo: Church,
  matrimonio: Heart,
  defuncion: Cross,
  entierro: Cross,
  residencia: MapPin,
  ocupacion: Briefcase,
  censo: FileText,
  inmigracion: Plane,
  emigracion: Plane,
};

const COLOR: Record<string, string> = {
  nacimiento: "bg-emerald-500",
  bautismo: "bg-sky-500",
  matrimonio: "bg-rose-500",
  defuncion: "bg-slate-600",
  entierro: "bg-slate-700",
  residencia: "bg-amber-500",
  ocupacion: "bg-violet-500",
  censo: "bg-cyan-500",
  inmigracion: "bg-indigo-500",
  emigracion: "bg-indigo-400",
};

function clasifica(label: string, tipo?: string): string {
  const k = (tipo ?? label).toLowerCase();
  for (const key of Object.keys(ICONS)) if (k.includes(key)) return key;
  return "evento";
}

export default function TimelineVisual({ eventos, persona }: { eventos: any[]; persona: any }) {
  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    if (persona.nac_fecha) out.push({ fecha: persona.nac_fecha, label: "Nacimiento", tipo: "nacimiento" });
    if (persona.bautismo_fecha) out.push({ fecha: persona.bautismo_fecha, label: "Bautismo", tipo: "bautismo" });
    if (persona.matrimonio_fecha) out.push({ fecha: persona.matrimonio_fecha, label: "Matrimonio", tipo: "matrimonio" });
    (eventos ?? []).forEach((e: any) => {
      if (e.fecha) out.push({ fecha: e.fecha, label: e.descripcion ?? e.tipo, tipo: e.tipo, lugar: e.lugar_original });
    });
    if (persona.defuncion_fecha) out.push({ fecha: persona.defuncion_fecha, label: "Defunción", tipo: "defuncion" });
    if (persona.entierro_fecha) out.push({ fecha: persona.entierro_fecha, label: "Entierro", tipo: "entierro" });
    return out.filter((x) => x.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [eventos, persona]);

  if (items.length === 0)
    return <p className="text-sm text-muted-foreground">Sin fechas suficientes para construir una línea de tiempo.</p>;

  const nacYear = persona.nac_fecha ? new Date(persona.nac_fecha).getUTCFullYear() : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-background via-background to-primary/[0.03] p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-y-0 left-[28px] w-[2px] bg-gradient-to-b from-primary/60 via-accent/40 to-transparent sm:left-[40px]" />
      <ol className="space-y-4">
        {items.map((it, i) => {
          const key = clasifica(it.label, it.tipo);
          const Icon = ICONS[key] ?? Sparkles;
          const color = COLOR[key] ?? "bg-primary";
          const y = new Date(it.fecha).getUTCFullYear();
          const edad = nacYear != null ? y - nacYear : null;
          return (
            <li key={i} className="relative flex items-start gap-3 sm:gap-5">
              <div className={`relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow-lg ring-4 ring-background sm:h-20 sm:w-20 ${color}`}>
                <Icon className="h-5 w-5 sm:h-7 sm:w-7" />
              </div>
              <div className="flex-1 rounded-xl border border-border/50 bg-card/70 p-3 backdrop-blur-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-2xl font-bold tracking-tight">{y}</span>
                    {edad != null && edad >= 0 && (
                      <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {edad === 0 ? "recién nacido" : `${edad} años`}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{key}</span>
                </div>
                <div className="mt-1 text-sm font-medium capitalize">{it.label}</div>
                {it.lugar && (
                  <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {it.lugar}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
