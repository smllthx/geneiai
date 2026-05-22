import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, History, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Punto = { anio: string | number; titulo: string; detalle: string; categoria: string };

const COLOR: Record<string, string> = {
  politica: "from-rose-500/30 to-rose-500/5 border-rose-500/40",
  economia: "from-amber-500/30 to-amber-500/5 border-amber-500/40",
  guerra: "from-red-700/30 to-red-700/5 border-red-700/40",
  migracion: "from-sky-500/30 to-sky-500/5 border-sky-500/40",
  cultura: "from-violet-500/30 to-violet-500/5 border-violet-500/40",
  tecnologia: "from-emerald-500/30 to-emerald-500/5 border-emerald-500/40",
  epidemia: "from-fuchsia-500/30 to-fuchsia-500/5 border-fuchsia-500/40",
  local: "from-primary/30 to-primary/5 border-primary/40",
};

export default function ContextoHistorico({ personaId }: { personaId: string }) {
  const [puntos, setPuntos] = useState<Punto[] | null>(null);
  const [meta, setMeta] = useState<{ periodo?: string; lugares?: string }>({});
  const [loading, setLoading] = useState(false);

  const cacheKey = `ctx-hist:${personaId}`;
  useEffect(() => {
    const c = localStorage.getItem(cacheKey);
    if (c) {
      try { const j = JSON.parse(c); setPuntos(j.puntos); setMeta({ periodo: j.periodo, lugares: j.lugares }); } catch {}
    }
  }, [personaId]);

  const generar = async () => {
    setLoading(true);
    const t = toast.loading("Investigando contexto histórico…");
    try {
      const { data, error } = await supabase.functions.invoke("contexto-historico", { body: { persona_id: personaId } });
      toast.dismiss(t);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPuntos(data.puntos);
      setMeta({ periodo: data.periodo, lugares: data.lugares });
      localStorage.setItem(cacheKey, JSON.stringify(data));
      toast.success("Contexto histórico generado");
    } catch (e: any) { toast.dismiss(t); toast.error(e.message ?? "Error"); }
    finally { setLoading(false); }
  };

  return (
    <Card className="archivo-card mt-4">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 font-serif text-lg">
          <History className="h-4 w-4 text-primary" /> Contexto histórico durante su vida
        </CardTitle>
        <Button size="sm" variant={puntos ? "outline" : "default"} onClick={generar} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {puntos ? "Regenerar" : "Generar"}
        </Button>
      </CardHeader>
      <CardContent>
        {meta.periodo && (
          <p className="mb-3 text-xs text-muted-foreground">
            <span className="font-medium">{meta.periodo}</span>
            {meta.lugares ? ` · ${meta.lugares}` : ""}
          </p>
        )}
        {!puntos ? (
          <p className="text-sm text-muted-foreground">
            Genera con IA los eventos políticos, guerras, migraciones, cultura y epidemias que marcaron su época en sus lugares de vida.
          </p>
        ) : puntos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos suficientes para construir el contexto.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {puntos.map((p, i) => (
              <div key={i} className={`rounded-xl border bg-gradient-to-br p-3 ${COLOR[p.categoria] ?? COLOR.local}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-base font-bold">{p.anio}</span>
                  <span className="rounded-full bg-background/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{p.categoria}</span>
                </div>
                <div className="mt-1 text-sm font-semibold">{p.titulo}</div>
                <div className="mt-1 text-xs text-foreground/80">{p.detalle}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
