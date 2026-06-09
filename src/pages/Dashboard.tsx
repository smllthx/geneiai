import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Search, Lightbulb, Brain, Users } from "lucide-react";
import { applyTreeScope, fetchAllPeople, getActiveTreeId } from "@/lib/peopleData";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    personas: 0, apellidos: [] as string[], lugares: 0, docsPendientes: 0,
    coincidencias: 0, hipotesis: 0, inferencias: 0,
  });
  const [recientes, setRecientes] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const treeId = await getActiveTreeId();
      const people = await fetchAllPeople("id,nombres,apellidos,updated_at", { treeId });
      const personIds = new Set(people.map((p) => p.id));
      const [l, d] = await Promise.all([
        supabase.from("lugares").select("id", { count: "exact", head: true }),
        applyTreeScope(supabase.from("documentos").select("id", { count: "exact", head: true }).eq("estado", "pendiente") as any, treeId),
      ]);
      const apellidoSet = new Map<string, number>();
      people.forEach((row) => {
        const a = row.apellidos?.split(/\s+/)[0]; if (!a) return;
        apellidoSet.set(a, (apellidoSet.get(a) ?? 0) + 1);
      });
      const top = [...apellidoSet.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([a]) => a);
      const [{ data: coincidencias }, { data: hipotesis }, { data: inferencias }] = await Promise.all([
        supabase.from("coincidencias").select("id,persona_id,persona_a_id,persona_b_id").eq("estado", "pendiente"),
        supabase.from("hipotesis").select("id,personas").eq("estado", "abierta"),
        supabase.from("generated_inferences").select("id,person_id").eq("status", "pending"),
      ]);
      setStats({
        personas: people.length, apellidos: top, lugares: l.count ?? 0,
        docsPendientes: d.count ?? 0,
        coincidencias: (coincidencias ?? []).filter((row: any) => [row.persona_id, row.persona_a_id, row.persona_b_id].some((id) => id && personIds.has(id))).length,
        hipotesis: (hipotesis ?? []).filter((row: any) => !row.personas?.length || row.personas.some((id: string) => personIds.has(id))).length,
        inferencias: (inferencias ?? []).filter((row: any) => personIds.has(row.person_id)).length,
      });
      setRecientes([...people].sort((a: any, b: any) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()).slice(0, 6));
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
