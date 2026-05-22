import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, GlassCard, EmptyState } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, AlertTriangle, BookOpen, Lightbulb, RefreshCw, Loader2, Globe2, ExternalLink, Brain } from "lucide-react";

type Contra = {
  id: string; tipo: string; severidad: string; titulo: string; descripcion: string | null;
  personas: string[]; estado: string; created_at: string;
};
type Hip = {
  id: string; titulo: string; descripcion: string | null; probabilidad: number | null; estado: string;
  argumentos_favor?: string | null; argumentos_contra?: string | null; proxima_accion?: string | null;
  personas?: string[] | null;
};
type Sug = { id: string; titulo: string; descripcion: string | null; origen: string | null; url_externa: string | null; created_at: string; persona_id: string | null };

export default function Insights() {
  const [tab, setTab] = useState<"contradicciones" | "hipotesis" | "biografias" | "externas">("contradicciones");
  const [contra, setContra] = useState<Contra[]>([]);
  const [hipo, setHipo] = useState<Hip[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [externas, setExternas] = useState<Sug[]>([]);
  const [scanning, setScanning] = useState(false);
  const [genHip, setGenHip] = useState(false);
  const [genBio, setGenBio] = useState<string | null>(null);
  const [genExt, setGenExt] = useState(false);
  const [pidExt, setPidExt] = useState<string>("");

  const cargar = async () => {
    const [{ data: c }, { data: h }, { data: p }, { data: s }] = await Promise.all([
      supabase.from("contradicciones").select("*").eq("estado", "abierta").order("severidad").order("created_at", { ascending: false }),
      supabase.from("hipotesis").select("id, titulo, descripcion, probabilidad, estado, argumentos_favor, argumentos_contra, proxima_accion, personas").order("updated_at", { ascending: false }).limit(80),
      supabase.from("personas").select("id, nombres, apellidos").order("apellidos").limit(2000),
      supabase.from("sugerencias").select("id, titulo, descripcion, origen, url_externa, created_at, persona_id").eq("tipo", "fuente_externa").order("created_at", { ascending: false }).limit(80),
    ]);
    setContra((c ?? []) as any);
    setHipo((h ?? []) as any);
    setPersonas(p ?? []);
    setExternas((s ?? []) as any);
    if (!pidExt && p?.[0]) setPidExt(p[0].id);
  };
  useEffect(() => { cargar(); }, []);

  const escanear = async () => {
    setScanning(true);
    try {
      const { error } = await supabase.functions.invoke("detectar-contradicciones");
      if (error) throw error;
      toast.success("Análisis terminado");
      await cargar();
    } catch (e: any) { toast.error(e.message ?? "Error al escanear"); }
    finally { setScanning(false); }
  };

  const generarHipotesis = async () => {
    setGenHip(true);
    const t = toast.loading("IA generando hipótesis avanzadas…");
    try {
      const { data, error } = await supabase.functions.invoke("generar-hipotesis-avanzadas");
      if (error) throw error;
      toast.dismiss(t); toast.success(`+${data?.creadas ?? 0} hipótesis nuevas`);
      setTab("hipotesis"); await cargar();
    } catch (e: any) { toast.dismiss(t); toast.error(e.message ?? "Error"); }
    finally { setGenHip(false); }
  };

  const buscarExternas = async () => {
    if (!pidExt) return;
    setGenExt(true);
    const t = toast.loading("Generando búsquedas en MyHeritage, FamilySearch y cementerios…");
    try {
      const { data, error } = await supabase.functions.invoke("buscar-myheritage-cementerios", { body: { persona_id: pidExt } });
      if (error) throw error;
      toast.dismiss(t); toast.success(`+${data?.creadas ?? 0} enlaces dirigidos`);
      setTab("externas"); await cargar();
    } catch (e: any) { toast.dismiss(t); toast.error(e.message ?? "Error"); }
    finally { setGenExt(false); }
  };

  const resolver = async (id: string) => {
    await supabase.from("contradicciones").update({ estado: "resuelta" }).eq("id", id);
    setContra((p) => p.filter((x) => x.id !== id));
  };

  const generarBio = async (personaId: string) => {
    setGenBio(personaId);
    try {
      const { error } = await supabase.functions.invoke("biografia-auto", { body: { person_id: personaId } });
      if (error) throw error;
      toast.success("Biografía solicitada — se actualizará en segundos.");
    } catch (e: any) { toast.error(e.message ?? "No se pudo generar"); }
    finally { setGenBio(null); }
  };

  const sevColor = (s: string) => s === "alta" ? "destructive" : s === "media" ? "default" : "secondary";
  const pName = (id: string) => { const p = personas.find((x) => x.id === id); return p ? `${p.nombres} ${p.apellidos}` : id.slice(0, 8); };

  return (
    <div>
      <SectionHeader
        eyebrow="GeneAI · Insights"
        title="Insights inteligentes"
        subtitle="Contradicciones, hipótesis avanzadas, biografías y búsquedas dirigidas en MyHeritage / FamilySearch / cementerios."
        actions={
          <Button onClick={escanear} disabled={scanning}>
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Escanear ahora
          </Button>
        }
      />

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1 text-sm">
        {([
          ["contradicciones", "Contradicciones", AlertTriangle, contra.length],
          ["hipotesis", "Hipótesis", Lightbulb, hipo.length],
          ["biografias", "Biografías IA", BookOpen, personas.length],
          ["externas", "Fuentes externas", Globe2, externas.length],
        ] as const).map(([k, l, Icon, n]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 transition ${tab === k ? "bg-background font-semibold shadow-sm" : "text-muted-foreground"}`}>
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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Hipótesis generadas por IA sobre todo el árbol: padres faltantes, medio-hermanos, migraciones, duplicados.</p>
            <Button size="sm" onClick={generarHipotesis} disabled={genHip}>
              {genHip ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              Generar hipótesis avanzadas
            </Button>
          </div>
          {hipo.length === 0 ? (
            <EmptyState icon={<Lightbulb className="h-5 w-5" />} title="Sin hipótesis aún"
              description="Pulsa “Generar hipótesis avanzadas” para que la IA analice tu árbol completo." />
          ) : (
            <ul className="divide-y divide-border/40">
              {hipo.map((h) => (
                <li key={h.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{h.titulo}</div>
                      {h.descripcion && <div className="mt-1 text-sm text-muted-foreground">{h.descripcion}</div>}
                      {(h.argumentos_favor || h.argumentos_contra) && (
                        <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                          {h.argumentos_favor && <div className="rounded bg-emerald-500/10 p-2 text-emerald-900 dark:text-emerald-200"><b>A favor:</b> {h.argumentos_favor}</div>}
                          {h.argumentos_contra && <div className="rounded bg-rose-500/10 p-2 text-rose-900 dark:text-rose-200"><b>En contra:</b> {h.argumentos_contra}</div>}
                        </div>
                      )}
                      {h.proxima_accion && <div className="mt-2 text-xs"><b>Próxima acción:</b> {h.proxima_accion}</div>}
                      {h.personas && h.personas.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {h.personas.slice(0, 6).map((pid) => (
                            <Link key={pid} to={`/personas/${pid}`} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20">{pName(pid)}</Link>
                          ))}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="shrink-0">{h.probabilidad ?? "?"}%</Badge>
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
          <p className="mb-3 text-sm text-muted-foreground">Genera biografías narrativas detalladas a partir de eventos, lugares, documentos y relaciones.</p>
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

      {tab === "externas" && (
        <GlassCard>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Persona</label>
              <Select value={pidExt} onValueChange={setPidExt}>
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent className="max-h-64">{personas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombres} {p.apellidos}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={buscarExternas} disabled={genExt || !pidExt}>
              {genExt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe2 className="h-4 w-4" />}
              Buscar en MyHeritage, FamilySearch y cementerios
            </Button>
          </div>
          {externas.length === 0 ? (
            <EmptyState icon={<Globe2 className="h-5 w-5" />} title="Sin búsquedas externas"
              description="Selecciona una persona y genera enlaces dirigidos a registros genealógicos, lápidas y periódicos." />
          ) : (
            <ul className="divide-y divide-border/40">
              {externas.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{s.titulo}</div>
                    <div className="text-xs text-muted-foreground">{s.origen}{s.persona_id ? ` · ${pName(s.persona_id)}` : ""}</div>
                  </div>
                  {s.url_externa && (
                    <a href={s.url_externa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                      Abrir <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      )}
    </div>
  );
}
