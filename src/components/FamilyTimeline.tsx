import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Item = { year: number; label: string; persona_id?: string; tipo: string };

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
          label: `${e.tipo}${e.lugar_original ? " · " + e.lugar_original : ""}`,
          persona_id: e.persona_id,
          tipo: e.tipo,
        });
      });
      out.sort((a, b) => b.year - a.year);
      setItems(out.slice(0, 40));
    })();
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<number, Item[]>();
    items.forEach((i) => { if (!m.has(i.year)) m.set(i.year, []); m.get(i.year)!.push(i); });
    return [...m.entries()];
  }, [items]);

  if (items.length === 0) return <p className="text-sm text-muted-foreground">Aún sin eventos con fecha registrados.</p>;

  return (
    <ol className="relative ml-2 border-l border-border/60 pl-5">
      {grouped.map(([year, list]) => (
        <li key={year} className="mb-4">
          <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
          <div className="font-display text-xl font-bold tracking-tight">{year}</div>
          <ul className="mt-1 space-y-1">
            {list.map((it, i) => (
              <li key={i} className="text-sm text-foreground/80">
                {it.persona_id ? (
                  <Link to={`/personas/${it.persona_id}`} className="hover:text-primary">{it.label}</Link>
                ) : it.label}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
