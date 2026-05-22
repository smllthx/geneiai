import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, GlassCard, EmptyState } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sparkles, AlertTriangle, BookOpen, Lightbulb, RefreshCw, Loader2 } from "lucide-react";

type Contra = {
  id: string; tipo: string; severidad: string; titulo: string; descripcion: string | null;
  personas: string[]; estado: string; created_at: string;
};
type Hip = { id: string; titulo: string; descripcion: string | null; probabilidad: number | null; estado: string };

export default function Insights() {
  const [tab, setTab] = useState<"contradicciones" | "hipotesis" | "biografias">("contradicciones");
  const [contra, setContra] = useState<Contra[]>([]);
  const [hipo, setHipo] = useState<Hip[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [genBio, setGenBio] = useState<string | null>(null);

  const cargar = async () => {
    const [{ data: c }, { data: h }, { data: p }] = await Promise.all([
      supabase.from("contradicciones").select("*").eq("estado", "abierta").order("severidad").order("created_at", { ascending: false }),
      supabase.from("hipotesis").select("id, titulo, descripcion, probabilidad, estado").order("updated_at", { ascending: false }).limit(50),
      supabase.from("personas").select("id, nombres, apellidos").order("apellidos").limit(2000),
    ]);
    setContra((c ?? []) as any);
    setHipo((h ?? []) as any);
    setPersonas(p ?? []);
  };
  useEffect(() => { cargar(); }, []);

  const escanear = async () => {
    setScanning(true);
    try {
      const { error } = await supabase.functions.invoke("detectar-contradicciones");
      if (error) throw error;
      toast.success("Análisis terminado");
      await cargar();
    } catch (e: any) {
      toast.error(e.message ?? "Error al escanear");
    } finally {
      setScanning(false);
    }
  };

  const resolver = async (id: string) => {
    await supabase.from("contradicciones").update({ estado: "resuelta" }).eq("id", id);
    setContra((p) => p.filter((x) => x.id !== id));
  };

  const generarBio = async (personaId: string) => {
    setGenBio(personaId);
    try {
      const { error } = await supabase.functions.invoke("biografia-auto", { body: { persona_id: personaId } });
      if (error) throw error;
      toast.success("Biografía solicitada — se actualizará en segundos.");
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo generar");
    } finally {
      setGenBio(null);
    }
  };

  const sevColor = (s: string) =>
    s === "alta" ? "destructive" : s === "media" ? "default" : "secondary";

  const pName = (id: string) => {
    const p = personas.find((x) => x.id === id);
    return p ? `${p.nombres} ${p.apellidos}` : id.slice(0, 8);
  };

  return (
    <div>
      <SectionHeader
        eyebrow="GeneAI · Insights"
        title="Insights inteligentes"
        subtitle="Contradicciones detectadas, hipótesis genealógicas y biografías generadas a partir de tu árbol."
        actions={
          <Button onClick={escanear} disabled={scanning}>
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Escanear ahora
          </Button>
        }
      />

      <div className="mb-4 flex gap-1 rounded-xl bg-muted p-1 text-sm">
        {([
          ["contradicciones", "Contradicciones", AlertTriangle, contra.length],
          ["hipotesis", "Hipótesis", Lightbulb, hipo.length],
          ["biografias", "Biografías IA", BookOpen, personas.length],
        ] as const).map(([k, l, Icon, n]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 transition ${tab === k ? "bg-background font-semibold shadow-sm" : "text-muted-foreground"}`}>
            <Icon className="h-4 w-4" /> {l}
            <span className="rounded-full bg-foreground/10 px-2 text-[10px]">{n}</span>
          </button>
        ))}
      </div>

      {tab === "contradicciones" && (
        <GlassCard>
          {contra.length === 0 ? (
            <EmptyState icon={<Sparkles className="h-5 w-5" />} title="Sin contradicciones"
              description="Pulsa “Escanear ahora” para analizar fechas, edades y relaciones del árbol."
              action={<Button onClick={escanear} disabled={scanning}>{scanning ? "Escaneando…" : "Escanear ahora"}</Button>} />
          ) : (
            <ul className="divide-y divide-border/40">
              {contra.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={sevColor(c.severidad) as any}>{c.severidad}</Badge>
                      <span className="text-xs text-muted-foreground">{c.tipo}</span>
                    </div>
                    <div className="mt-1 font-medium">{c.titulo}</div>
                    {c.descripcion && <div className="text-sm text-muted-foreground">{c.descripcion}</div>}
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {c.personas.map((pid) => (
                        <Link key={pid} to={`/personas/${pid}`} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20">
                          {pName(pid)}
                        </Link>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => resolver(c.id)}>Marcar como resuelta</Button>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      )}

      {tab === "hipotesis" && (
        <GlassCard>
          {hipo.length === 0 ? (
            <EmptyState icon={<Lightbulb className="h-5 w-5" />} title="Sin hipótesis aún"
              description="Las hipótesis se crean desde la ficha de cada persona con “Investigar con IA”." />
          ) : (
            <ul className="divide-y divide-border/40">
              {hipo.map((h) => (
                <li key={h.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">{h.titulo}</div>
                      {h.descripcion && <div className="text-sm text-muted-foreground line-clamp-2">{h.descripcion}</div>}
                    </div>
                    <Badge variant="outline">{h.probabilidad ?? "?"}%</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 text-right">
            <Link to="/hipotesis" className="text-sm text-link hover:underline">Ver gestor completo →</Link>
          </div>
        </GlassCard>
      )}

      {tab === "biografias" && (
        <GlassCard>
          <p className="mb-3 text-sm text-muted-foreground">
            Genera una biografía narrativa y detallada para cualquier persona, combinando eventos, lugares, documentos y relaciones.
          </p>
          <ul className="max-h-[60vh] divide-y divide-border/40 overflow-y-auto">
            {personas.slice(0, 100).map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <Link to={`/personas/${p.id}`} className="text-sm hover:text-primary">
                  <span className="font-bold">{p.nombres} {p.apellidos}</span>
                </Link>
                <Button size="sm" variant="outline" disabled={genBio === p.id} onClick={() => generarBio(p.id)}>
                  {genBio === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Biografía IA
                </Button>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}
    </div>
  );
}
