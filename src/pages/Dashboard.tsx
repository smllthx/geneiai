import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Search, Lightbulb, Brain, Users } from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    personas: 0, apellidos: [] as string[], lugares: 0, docsPendientes: 0,
    coincidencias: 0, hipotesis: 0, inferencias: 0,
  });
  const [recientes, setRecientes] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [p, l, d, c, h, i, r] = await Promise.all([
        supabase.from("personas").select("apellidos", { count: "exact" }),
        supabase.from("lugares").select("id", { count: "exact", head: true }),
        supabase.from("documentos").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
        supabase.from("coincidencias").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
        supabase.from("hipotesis").select("id", { count: "exact", head: true }).eq("estado", "abierta"),
        supabase.from("generated_inferences").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("personas").select("id,nombres,apellidos,updated_at").order("updated_at", { ascending: false }).limit(6),
      ]);
      const apellidoSet = new Map<string, number>();
      (p.data ?? []).forEach((row) => {
        const a = row.apellidos?.split(/\s+/)[0]; if (!a) return;
        apellidoSet.set(a, (apellidoSet.get(a) ?? 0) + 1);
      });
      const top = [...apellidoSet.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([a]) => a);
      setStats({
        personas: p.count ?? 0, apellidos: top, lugares: l.count ?? 0,
        docsPendientes: d.count ?? 0, coincidencias: c.count ?? 0,
        hipotesis: h.count ?? 0, inferencias: i.count ?? 0,
      });
      setRecientes(r.data ?? []);
    })();
  }, []);

  const Stat = ({ label, value, hint }: any) => (
    <Card className="archivo-card"><CardHeader className="pb-2"><CardTitle className="font-serif text-3xl">{value}</CardTitle></CardHeader>
      <CardContent><p className="text-sm font-medium">{label}</p>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</CardContent></Card>
  );

  return (
    <div>
      <PageHeader
        title="Centro de investigación"
        subtitle="Una mirada general al archivo familiar: lo registrado, lo pendiente y lo que falta investigar."
        actions={<>
          <Button size="sm" onClick={() => navigate("/personas/nueva")}><Plus className="h-4 w-4" /> Nueva persona</Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/documentos")}><FileText className="h-4 w-4" /> Documentos</Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/buscar")}><Search className="h-4 w-4" /> Buscar</Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/hipotesis")}><Lightbulb className="h-4 w-4" /> Hipótesis</Button>
        </>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Personas" value={stats.personas} />
        <Stat label="Lugares" value={stats.lugares} />
        <Stat label="Documentos pendientes" value={stats.docsPendientes} hint="por transcribir" />
        <Stat label="Coincidencias" value={stats.coincidencias} hint="sugeridas" />
        <Stat label="Hipótesis abiertas" value={stats.hipotesis} />
        <Stat label="Inferencias automáticas" value={stats.inferencias} hint="pendientes de revisar" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="archivo-card">
          <CardHeader><CardTitle className="font-serif text-xl">Apellidos principales</CardTitle></CardHeader>
          <CardContent>
            {stats.apellidos.length === 0
              ? <p className="text-sm text-muted-foreground">Aún sin personas registradas.</p>
              : <div className="flex flex-wrap gap-2">{stats.apellidos.map((a) => <span key={a} className="archivo-chip">{a}</span>)}</div>}
          </CardContent>
        </Card>
        <Card className="archivo-card">
          <CardHeader><CardTitle className="font-serif text-xl">Últimas personas editadas</CardTitle></CardHeader>
          <CardContent>
            {recientes.length === 0
              ? <p className="text-sm text-muted-foreground">Sin actividad reciente.</p>
              : <ul className="divide-y divide-border">
                {recientes.map((p) => (
                  <li key={p.id}>
                    <button className="flex w-full items-center gap-2 py-2 text-left text-sm hover:text-accent" onClick={() => navigate(`/personas/${p.id}`)}>
                      <Users className="h-4 w-4 text-muted-foreground" /> {p.nombres} {p.apellidos}
                    </button>
                  </li>
                ))}
              </ul>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
