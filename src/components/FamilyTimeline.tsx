import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Baby, Heart, Cross, Plane, MapPin, Briefcase, Church, FileText, Sparkles } from "lucide-react";

type Item = { year: number; label: string; persona_id?: string; tipo: string; lugar?: string };

const ICONS: Record<string, any> = {
  nacimiento: Baby, bautismo: Church, matrimonio: Heart, defuncion: Cross,
  residencia: MapPin, ocupacion: Briefcase, censo: FileText, inmigracion: Plane, emigracion: Plane,
};
const COLOR: Record<string, string> = {
  nacimiento: "bg-emerald-500", bautismo: "bg-sky-500", matrimonio: "bg-rose-500", defuncion: "bg-slate-600",
  residencia: "bg-amber-500", ocupacion: "bg-violet-500", censo: "bg-cyan-500", inmigracion: "bg-indigo-500", emigracion: "bg-indigo-400",
};

function clasifica(t: string) {
  const k = t.toLowerCase();
  for (const key of Object.keys(ICONS)) if (k.includes(key)) return key;
  return "evento";
}

export default function FamilyTimeline() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: personas }, { data: eventos }] = await Promise.all([
        supabase.from("personas").select("id,nombres,apellidos,nac_fecha,defuncion_fecha,matrimonio_fecha"),
        supabase.from("eventos").select("persona_id,tipo,fecha,lugar_original").not("fecha", "is", null).order("fecha"),
      ]);
      const out: Item[] = [];
      (personas ?? []).forEach((p: any) => {
        const nm = `${p.nombres} ${p.apellidos}`.trim();
        if (p.nac_fecha) out.push({ year: new Date(p.nac_fecha).getUTCFullYear(), label: `Nace ${nm}`, persona_id: p.id, tipo: "nacimiento" });
        if (p.defuncion_fecha) out.push({ year: new Date(p.defuncion_fecha).getUTCFullYear(), label: `Muere ${nm}`, persona_id: p.id, tipo: "defuncion" });
        if (p.matrimonio_fecha) out.push({ year: new Date(p.matrimonio_fecha).getUTCFullYear(), label: `Matrimonio de ${nm}`, persona_id: p.id, tipo: "matrimonio" });
      });
      (eventos ?? []).forEach((e: any) => {
        out.push({
          year: new Date(e.fecha).getUTCFullYear(),
          label: e.tipo, lugar: e.lugar_original,
          persona_id: e.persona_id, tipo: e.tipo,
        });
      });
      out.sort((a, b) => b.year - a.year);
      setItems(out.slice(0, 50));
    })();
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<number, Item[]>();
    items.forEach((i) => { if (!m.has(i.year)) m.set(i.year, []); m.get(i.year)!.push(i); });
    return [...m.entries()];
  }, [items]);

  if (items.length === 0) return <p className="text-sm text-muted-foreground">Aún sin eventos con fecha registrados.</p>;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-[19px] w-[2px] bg-gradient-to-b from-primary/60 via-accent/40 to-transparent" />
      <ol className="space-y-4">
        {grouped.map(([year, list]) => (
          <li key={year} className="relative pl-12">
            <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-[11px] font-bold text-primary-foreground shadow-lg ring-4 ring-background">
              {year}
            </div>
            <ul className="space-y-1.5">
              {list.map((it, i) => {
                const key = clasifica(it.tipo);
                const Icon = ICONS[key] ?? Sparkles;
                const color = COLOR[key] ?? "bg-primary";
                return (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${color}`}>
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="flex-1 capitalize text-foreground/85">
                      {it.persona_id ? (
                        <Link to={`/personas/${it.persona_id}`} className="hover:text-primary">{it.label}</Link>
                      ) : it.label}
                      {it.lugar && <span className="text-muted-foreground"> · {it.lugar}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
