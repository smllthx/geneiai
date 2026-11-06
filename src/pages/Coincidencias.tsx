import { fetchAllPeople, getActiveTreeId } from "@/lib/peopleData";
import { collectPages } from "@/lib/collectPages";
import { usePeopleRevision } from "@/hooks/use-realtime-reload";
import { lifeDates } from "@/lib/personDates";
import PersonPortrait from "@/components/PersonPortrait";
import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, GlassCard, EmptyState } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Sparkles, GitMerge, X, Check, Users } from "@/components/icons";
import { toast } from "sonner";
import { toDisplayTextList } from "@/lib/safeText";

export default function Coincidencias() {
  const peopleRevision = usePeopleRevision();
  const [items, setItems] = useState<any[]>([]);
  const [personasMap, setPersonasMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState("todas");
  const request = useRef(0);

  const load = async () => {
    const current = ++request.current;
    try {
      const treeId = await getActiveTreeId();
      if (!treeId) { setItems([]); setPersonasMap(new Map()); return; }
      const [c, ps] = await Promise.all([
        collectPages((from,to) => supabase.from("coincidencias").select("*").order("id").range(from,to)),
        fetchAllPeople<any>("id,nombres,apellidos,foto_url,nac_fecha,nac_fecha_aprox,nac_rango_ini,nac_rango_fin,defuncion_fecha,viva", {treeId,includeUnscoped:false}),
      ]);
      if(current !== request.current) return;
      const people = new Map(ps.map(p=>[p.id,p]));
      setItems(c.filter(item=>people.has(item.ref_a)&&people.has(item.ref_b)));
      setPersonasMap(people);
    } catch { if(current===request.current){setItems([]);setPersonasMap(new Map());toast.error("No se pudieron cargar las coincidencias del árbol actual.");} }
  };
  useEffect(() => { void load(); return () => {request.current++;}; }, [peopleRevision]);

  const detectar = async () => {
    setLoading(true);
    const t = toast.loading("Analizando personas…");
    try {
      const { data, error } = await supabase.functions.invoke("detectar-coincidencias");
      toast.dismiss(t);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${data.creadas} coincidencias nuevas sobre ${data.analizadas} personas`);
      load();
    } catch (e: any) { toast.dismiss(t); toast.error(e.message ?? "Error"); }
    finally { setLoading(false); }
  };

  const cambiarEstado = async (id: string, estado: "confirmada" | "rechazada") => {
    const { error } = await supabase.from("coincidencias").update({ estado }).eq("id", id).eq("estado", "pendiente");
    if (error) { toast.error("No se pudo guardar la revisión."); return; }
    void load();
  };

  const visibles = items.filter(c => filtro === "todas" || c.estado === filtro);

  return (
    <div>
      <SectionHeader
        eyebrow="Detección automática"
        title="Coincidencias"
        subtitle="Árbol actual · Candidatos por nombre, variantes, fechas y lugar. Revisa las fuentes antes de decidir."
        actions={
          <Button onClick={detectar} disabled={loading}>
            <Sparkles className="h-4 w-4" /> {loading ? "Detectando…" : "Detectar coincidencias"}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { v: "todas", l: `Todas (${items.length})` },
          { v: "pendiente", l: `Pendientes (${items.filter((c) => c.estado === "pendiente").length})` },
          { v: "confirmada", l: `Confirmadas (${items.filter((c) => c.estado === "confirmada").length})` },
          { v: "rechazada", l: `Descartadas (${items.filter((c) => c.estado === "rechazada").length})` },
        ].map((f) => (
          <button key={f.v} onClick={() => setFiltro(f.v as any)}
            className={`glass-pill ${filtro === f.v ? "ring-2 ring-primary" : ""}`}>{f.l}</button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <EmptyState icon={<GitMerge className="h-5 w-5" />} title="Sin coincidencias"
          description="Pulsa 'Detectar coincidencias' para analizar tu árbol." />
      ) : (
        <div className="grid gap-3">
          {visibles.map((c) => {
            const a = personasMap.get(c.ref_a);
            const b = personasMap.get(c.ref_b);
            return (
              <GlassCard key={c.id} className="p-4">
                <div className="flex items-center gap-2 text-sm mb-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">Comparar fichas</span>
                  <span className="ml-auto glass-pill text-xs capitalize">{c.estado}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[a, b].map((p, i) => p ? (
                    <Link key={p.id} to={`/personas/${p.id}`}
                      className="flex items-center gap-3 rounded-2xl p-2 hover:bg-foreground/5 transition-colors">
                      <PersonPortrait person={p} className="h-10 w-10 shrink-0 rounded-full" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.nombres} {p.apellidos}</p>
                        <p className="text-xs text-muted-foreground">
                          {lifeDates(p) || "Sin fechas registradas"}
                        </p>
                      </div>
                    </Link>
                  ) : <div key={i} className="text-xs text-muted-foreground">Persona eliminada</div>)}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {toDisplayTextList(c.razones).map((r, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-foreground/5">{r}</span>
                  ))}
                </div>
                {c.estado === "pendiente" && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => cambiarEstado(c.id, "confirmada")}>
                      <Check className="h-3 w-3" /> Confirmar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => cambiarEstado(c.id, "rechazada")}>
                      <X className="h-3 w-3" /> Descartar
                    </Button>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
