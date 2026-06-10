import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, GlassCard, EmptyState } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Sparkles, GitMerge, X, Check, Users } from "lucide-react";
import { toast } from "sonner";
import { toDisplayTextList } from "@/lib/safeText";

export default function Coincidencias() {
  const [items, setItems] = useState<any[]>([]);
  const [personasMap, setPersonasMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState<"todas" | "alto" | "medio" | "pendientes">("todas");

  const load = async () => {
    const [{ data: c }, { data: ps }] = await Promise.all([
      supabase.from("coincidencias").select("*").order("score", { ascending: false }),
      supabase.from("personas").select("id,nombres,apellidos,foto_url,nac_fecha,defuncion_fecha"),
    ]);
    setItems(c ?? []);
    setPersonasMap(new Map((ps ?? []).map((p: any) => [p.id, p])));
  };
  useEffect(() => { load(); }, []);

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
    await supabase.from("coincidencias").update({ estado }).eq("id", id);
    load();
  };

  const visibles = items.filter((c) => {
    if (filtro === "alto") return c.score >= 80;
    if (filtro === "medio") return c.score >= 60 && c.score < 80;
    if (filtro === "pendientes") return c.estado === "pendiente";
    return true;
  });

  return (
    <div>
      <SectionHeader
        eyebrow="Detección automática"
        title="Coincidencias"
        subtitle="Pares de personas potencialmente duplicadas o relacionadas, detectadas por nombre, fechas, lugar y sexo."
        actions={
          <Button onClick={detectar} disabled={loading}>
            <Sparkles className="h-4 w-4" /> {loading ? "Detectando…" : "Detectar coincidencias"}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { v: "todas", l: `Todas (${items.length})` },
          { v: "alto", l: `Alta (${items.filter((c) => c.score >= 80).length})` },
          { v: "medio", l: `Media (${items.filter((c) => c.score >= 60 && c.score < 80).length})` },
          { v: "pendientes", l: `Pendientes (${items.filter((c) => c.estado === "pendiente").length})` },
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
            const scoreColor = c.score >= 80 ? "text-primary" : c.score >= 60 ? "text-accent" : "text-muted-foreground";
            return (
              <GlassCard key={c.id} className="p-4">
                <div className="flex items-center gap-2 text-sm mb-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className={`font-display text-2xl font-bold ${scoreColor}`}>{c.score}</span>
                  <span className="text-xs text-muted-foreground">/100</span>
                  <span className="ml-auto glass-pill text-xs capitalize">{c.estado}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[a, b].map((p, i) => p ? (
                    <Link key={p.id} to={`/personas/${p.id}`}
                      className="flex items-center gap-3 rounded-2xl p-2 hover:bg-foreground/5 transition-colors">
                      {p.foto_url ? (
                        <img src={p.foto_url} className="h-10 w-10 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-foreground/10" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.nombres} {p.apellidos}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.nac_fecha ? new Date(p.nac_fecha).getUTCFullYear() : "?"}
                          {p.defuncion_fecha ? `–${new Date(p.defuncion_fecha).getUTCFullYear()}` : ""}
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
