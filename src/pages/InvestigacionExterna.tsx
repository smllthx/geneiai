import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Brain, Lightbulb, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { notify } from "@/lib/notifications";

export default function InvestigacionExterna() {
  const [personas, setPersonas] = useState<any[]>([]);
  const [pid, setPid] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    supabase.from("personas").select("id, nombres, apellidos").order("apellidos").then(({ data }) => {
      setPersonas(data ?? []); if (data?.[0]) setPid(data[0].id);
    });
  }, []);

  const investigar = async () => {
    if (!pid) return;
    setBusy(true); setResult(null);
    const t = toast.loading("IA investigando…");
    try {
      const { data, error } = await supabase.functions.invoke("investigar-auto", { body: { person_id: pid } });
      toast.dismiss(t);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      toast.success(`+${data.hipotesis_creadas} hipótesis · +${data.sugerencias_creadas} sugerencias`);
    } catch (e: any) {
      toast.dismiss(t); toast.error(e.message ?? "Error");
    } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader
        title="Investigación automática con IA"
        subtitle="La app analiza a la persona, razona sobre su contexto histórico-familiar y propone hipótesis y cambios concretos al árbol. Sin enlaces externos: todo se aplica desde acá."
      />
      {personas.length === 0 ? (
        <p className="text-muted-foreground">Crea una persona primero.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <Select value={pid} onValueChange={setPid}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {personas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombres} {p.apellidos}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={investigar} disabled={busy || !pid}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {busy ? "Investigando…" : "Investigar automáticamente"}
            </Button>
          </div>

          {result && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4" /> Análisis</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>{result.analisis}</p>
                  {result.lagunas?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Lagunas detectadas:</p>
                      <ul className="ml-4 list-disc text-xs">{result.lagunas.map((l: string, i: number) => <li key={i}>{l}</li>)}</ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {result.hipotesis?.length > 0 && (
                <div>
                  <h3 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold">
                    <Lightbulb className="h-4 w-4" /> Hipótesis ({result.hipotesis.length})
                  </h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    {result.hipotesis.map((h: any, i: number) => (
                      <Card key={i}>
                        <CardHeader className="pb-1"><CardTitle className="text-sm">{h.titulo} <span className="ml-2 text-xs font-normal text-muted-foreground">({h.probabilidad}%)</span></CardTitle></CardHeader>
                        <CardContent className="space-y-1 text-xs">
                          <p>{h.descripcion}</p>
                          {h.proxima_accion && <p className="text-muted-foreground"><strong>Próximo paso:</strong> {h.proxima_accion}</p>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Link to="/hipotesis" className="mt-2 inline-block text-xs text-primary underline">Ver todas en Hipótesis →</Link>
                </div>
              )}

              {result.sugerencias?.length > 0 && (
                <div>
                  <h3 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold">
                    <CheckCircle2 className="h-4 w-4" /> Sugerencias accionables ({result.sugerencias.length})
                  </h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    {result.sugerencias.map((s: any, i: number) => (
                      <Card key={i}>
                        <CardHeader className="pb-1"><CardTitle className="text-sm">{s.titulo} <span className="ml-2 text-xs font-normal text-muted-foreground">({s.confianza}%)</span></CardTitle></CardHeader>
                        <CardContent className="space-y-1 text-xs">
                          <p className="text-muted-foreground">{s.tipo}</p>
                          {s.descripcion && <p>{s.descripcion}</p>}
                          <pre className="overflow-x-auto rounded bg-muted p-2 text-[10px]">{JSON.stringify(s.payload, null, 2)}</pre>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Link to="/pistas" className="mt-2 inline-block text-xs text-primary underline">Revisar y aceptar en Pistas →</Link>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
