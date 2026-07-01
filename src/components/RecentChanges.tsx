import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, Clock } from "lucide-react";
import { toDisplayText } from "@/lib/safeText";

type Change = { tipo: string; descripcion: unknown; fecha: string };

export default function RecentChanges({ personaId }: { personaId: string }) {
  const [items, setItems] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: p }, { data: evs }, { data: rels }] = await Promise.all([
        supabase.from("personas").select("updated_at,created_at").eq("id", personaId).maybeSingle(),
        supabase.from("eventos").select("tipo,descripcion,fecha,created_at,updated_at").eq("persona_id", personaId).order("updated_at", { ascending: false }).limit(20),
        supabase.from("relaciones").select("tipo,created_at").or(`persona_id.eq.${personaId},pariente_id.eq.${personaId}`).order("created_at", { ascending: false }).limit(20),
      ]);
      const changes: Change[] = [];
      if (p?.updated_at && p.updated_at !== p.created_at) {
        changes.push({ tipo: "Persona actualizada", descripcion: "Datos personales modificados", fecha: p.updated_at });
      }
      if (p?.created_at) {
        changes.push({ tipo: "Persona creada", descripcion: "Registro agregado al árbol", fecha: p.created_at });
      }
      for (const e of evs ?? []) {
        changes.push({ tipo: `Evento: ${e.tipo}`, descripcion: e.descripcion ?? "Sin descripción", fecha: e.updated_at ?? e.created_at });
      }
      for (const r of rels ?? []) {
        changes.push({ tipo: `Relación: ${r.tipo}`, descripcion: "Relación familiar añadida", fecha: r.created_at });
      }
      changes.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      setItems(changes.slice(0, 15));
      setLoading(false);
    })();
  }, [personaId]);

  const fmt = (d: string) => {
    const t = new Date(d);
    const diff = Date.now() - t.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs} h`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `hace ${days} d`;
    return t.toLocaleDateString("es");
  };

  return (
    <Card className="archivo-card">
      <CardHeader className="pb-2 flex flex-row items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <CardTitle className="font-display text-base">Cambios recientes</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin cambios registrados.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((c, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium">{c.tipo}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{toDisplayText(c.descripcion) || "Sin descripción"}</div>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{fmt(c.fecha)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
