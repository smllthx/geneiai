import { birthSortYear, birthLabel } from "@/lib/personDates";
import { usePeopleRevision } from "@/hooks/use-realtime-reload";
import PersonPortrait from "@/components/PersonPortrait";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";

export default function LineaDeTiempo() {
  const peopleRevision = usePeopleRevision();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const [{ data: ps }, { data: ev }] = await Promise.all([
        supabase.from("personas").select("id,nombres,apellidos,foto_url,nac_fecha,nac_fecha_aprox,nac_rango_ini,nac_rango_fin,defuncion_fecha,matrimonio_fecha"),
        supabase.from("eventos").select("*"),
      ]);
      const all: any[] = [];
      const byId = new Map((ps ?? []).map((p) => [p.id, p]));
      for (const p of ps ?? []) {
        const birthYear = birthSortYear(p);
        if (birthYear != null) all.push({ person: p, fecha: p.nac_fecha || String(birthYear), dateLabel: birthLabel(p), label: `Nacimiento — ${p.nombres} ${p.apellidos}` });
        if (p.matrimonio_fecha) all.push({ person: p, fecha: p.matrimonio_fecha, label: `Matrimonio — ${p.nombres} ${p.apellidos}` });
        if (p.defuncion_fecha) all.push({ person: p, fecha: p.defuncion_fecha, label: `Defunción — ${p.nombres} ${p.apellidos}` });
      }
      for (const e of ev ?? []) if (e.fecha) {
        const p = byId.get(e.persona_id);
        all.push({ person: p, fecha: e.fecha, label: `${e.tipo} — ${p?.nombres ?? ""} ${p?.apellidos ?? ""} ${e.lugar_original ? "· " + e.lugar_original : ""}` });
      }
      all.sort((a, b) => a.fecha.localeCompare(b.fecha));
      setItems(all);
    })();
  }, [peopleRevision]);
  return (
    <div>
      <PageHeader title="Línea de tiempo" subtitle="Todos los eventos del archivo, ordenados cronológicamente." />
      {items.length === 0 ? <p className="text-muted-foreground">Sin eventos con fecha aún.</p> :
        <ol className="relative ml-3 border-l border-border pl-6">{items.map((it, i) => (
          <li key={i} className="mb-3"><span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-primary" />
            <div className="font-serif text-lg">{it.dateLabel || new Date(it.fecha).getUTCFullYear()}</div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {it.person && <PersonPortrait person={it.person} className="h-8 w-8 shrink-0 rounded-full" />}
              {it.label}
            </div></li>
        ))}</ol>}
    </div>
  );
}
