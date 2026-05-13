import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sparkles, Search, AlertTriangle, ArrowRight } from "lucide-react";

type Prioridad = { id: string; nombre: string; faltantes: string[]; score: number };

export default function Agente() {
  const [prio, setPrio] = useState<Prioridad[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: personas } = await supabase
      .from("personas")
      .select("id, nombres, apellidos, nac_fecha, defuncion_fecha, nac_lugar_id, ocupacion, viva")
      .limit(200);

    const list: Prioridad[] = (personas ?? []).map((p) => {
      const faltantes: string[] = [];
      if (!p.nac_fecha) faltantes.push("nacimiento");
      if (!p.defuncion_fecha && p.viva !== "si") faltantes.push("defunción");
      if (!p.nac_lugar_id) faltantes.push("lugar de origen");
      if (!p.ocupacion) faltantes.push("ocupación");
      return {
        id: p.id,
        nombre: `${p.nombres} ${p.apellidos}`.trim(),
        faltantes,
        score: faltantes.length,
      };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 10);
    setPrio(list); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const investigar = async (person_id: string) => {
    setRunning(person_id);
    const t = toast.loading("Investigando con IA…");
    try {
      const { data, error } = await supabase.functions.invoke("investigar-persona", { body: { person_id } });
      toast.dismiss(t);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${data.hipotesis_creadas} hipótesis · ${data.busquedas_creadas} búsquedas · ${data.tareas_creadas} tareas`);
    } catch (e: any) { toast.dismiss(t); toast.error(e.message ?? "Error"); }
    setRunning(null);
  };

  const escanearTestigos = async () => {
    const t = toast.loading("Escaneando documentos…");
    try {
      const { data, error } = await supabase.functions.invoke("buscar-testigos", { body: {} });
      toast.dismiss(t);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${data.coincidencias_creadas} coincidencias · ${data.documentos_actualizados} documentos actualizados`);
    } catch (e: any) { toast.dismiss(t); toast.error(e.message ?? "Error"); }
  };

  return (
    <div>
      <PageHeader
        title="Agente de investigación"
        subtitle="La app revisa tu árbol, encuentra lagunas y propone búsquedas concretas."
        actions={<Button onClick={escanearTestigos} variant="outline"><Search className="h-4 w-4" /> Escanear testigos cruzados</Button>}
      />

      <Alert className="mb-6 border-accent/30 bg-accent/5">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Aviso</AlertTitle>
        <AlertDescription>
          Las hipótesis y búsquedas son sugerencias automáticas. Nada se da por comprobado hasta que vos lo verifiques con una fuente documental.
        </AlertDescription>
      </Alert>

      <Card className="archivo-card">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Para investigar hoy</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> :
            prio.length === 0 ? <p className="text-sm text-muted-foreground">No hay personas con datos faltantes. ¡Buen trabajo!</p> :
            <ul className="divide-y divide-border">
              {prio.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link to={`/personas/${x.id}`} className="font-serif text-base hover:underline">{x.nombre}</Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {x.faltantes.map((f) => <Badge key={f} variant="secondary" className="text-xs">Falta {f}</Badge>)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={running === x.id} onClick={() => investigar(x.id)}>
                      <Sparkles className="h-4 w-4" /> {running === x.id ? "…" : "Investigar"}
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link to={`/personas/${x.id}`}><ArrowRight className="h-4 w-4" /></Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          }
        </CardContent>
      </Card>
    </div>
  );
}
