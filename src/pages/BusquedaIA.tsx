import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, GlassCard, EmptyState } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sparkles, User, Globe2, Search, Link2, Loader2, ExternalLink, Check, X, Lightbulb } from "lucide-react";

type Hallazgo = {
  titulo: string; fuente?: string; url: string; resumen: string;
  personas?: string[]; fechas?: string[]; lugares?: string[];
  motivo?: string; confianza: "alta" | "media" | "baja";
  id?: string;
};

export default function BusquedaIA() {
  const [tab, setTab] = useState<"persona" | "manual" | "url">("persona");
  const [personas, setPersonas] = useState<any[]>([]);
  const [pid, setPid] = useState<string>("");
  const [manual, setManual] = useState({ nombres: "", apellidos: "", lugar: "", anos: "", palabras: "" });
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("personas").select("id, nombres, apellidos").order("apellidos").then(({ data }) => {
      setPersonas(data ?? []); if (data?.[0]) setPid(data[0].id);
    });
    cargarHistorial();
  }, []);

  const cargarHistorial = async () => {
    const { data } = await supabase.from("sugerencias").select("id, titulo, descripcion, origen, url_externa, confianza, estado, persona_id, payload, created_at").eq("tipo", "hallazgo_ia").order("created_at", { ascending: false }).limit(30);
    setHistorial(data ?? []);
  };

  const ejecutar = async () => {
    setBusy(true); setHallazgos([]);
    const t = toast.loading("Agente IA buscando…");
    try {
      const body: any = { modo: tab };
      if (tab === "persona") body.persona_id = pid;
      else if (tab === "manual") Object.assign(body, manual);
      else if (tab === "url") body.url = url;
      const { data, error } = await supabase.functions.invoke("busqueda-ia", { body });
      toast.dismiss(t);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setHallazgos(data.hallazgos ?? []);
      toast.success(`+${data.hallazgos?.length ?? 0} hallazgo(s)`);
      await cargarHistorial();
    } catch (e: any) {
      toast.dismiss(t); toast.error(e.message ?? "Error en la búsqueda");
    } finally { setBusy(false); }
  };

  const actuar = async (id: string | undefined, accion: "aceptada" | "rechazada" | "hipotesis") => {
    if (!id) return;
    if (accion === "hipotesis") {
      const h = historial.find((x) => x.id === id);
      if (h) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("hipotesis").insert({
          user_id: user!.id,
          titulo: h.titulo,
          descripcion: h.descripcion,
          probabilidad: h.confianza ?? 50,
          personas: h.persona_id ? [h.persona_id] : [],
          proxima_accion: "Revisar fuente y verificar datos.",
        });
        toast.success("Guardado como hipótesis");
      }
      await supabase.from("sugerencias").update({ estado: "aceptada" }).eq("id", id);
    } else {
      await supabase.from("sugerencias").update({ estado: accion }).eq("id", id);
    }
    await cargarHistorial();
  };

  const confColor = (c: string) => c === "alta" ? "default" : c === "media" ? "secondary" : "outline";

  const lista = useMemo(() => (hallazgos.length ? hallazgos : historial.map((h) => ({
    id: h.id, titulo: h.titulo, fuente: h.origen, url: h.url_externa, resumen: h.descripcion ?? "",
    personas: h.payload?.personas, fechas: h.payload?.fechas, lugares: h.payload?.lugares,
    motivo: h.payload?.motivo, confianza: h.confianza >= 75 ? "alta" : h.confianza >= 50 ? "media" : "baja",
    estado: h.estado, persona_id: h.persona_id,
  }))) as any[], [hallazgos, historial]);

  return (
    <div>
      <SectionHeader
        eyebrow="GeneAI · Búsqueda IA"
        title="Búsqueda IA"
        subtitle="Agentes que buscan en internet por ti: por persona del árbol, manualmente o desde una URL."
      />

      {/* Selector de modo */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {([
          ["persona", "Por persona", User],
          ["manual", "Manual", Search],
          ["url", "Desde URL", Link2],
        ] as const).map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-4 text-sm transition ${tab === k ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border/60 text-muted-foreground hover:bg-muted"}`}>
            <Icon className="h-6 w-6" /> {l}
          </button>
        ))}
      </div>

      {/* Formularios */}
      <GlassCard className="mb-4">
        {tab === "persona" && (
          <div className="space-y-3">
            <Label>Persona del árbol</Label>
            <Select value={pid} onValueChange={setPid}>
              <SelectTrigger className="h-12"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
              <SelectContent className="max-h-72">{personas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombres} {p.apellidos}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">La IA usará nombres, variantes, fechas, lugares, familiares y fuentes ya guardadas.</p>
            <Button size="lg" className="w-full" onClick={ejecutar} disabled={busy || !pid}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />} Buscar
            </Button>
          </div>
        )}
        {tab === "manual" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Nombres</Label><Input value={manual.nombres} onChange={(e) => setManual({ ...manual, nombres: e.target.value })} placeholder="Luis Armando" /></div>
            <div><Label>Apellidos</Label><Input value={manual.apellidos} onChange={(e) => setManual({ ...manual, apellidos: e.target.value })} placeholder="Sanguineti" /></div>
            <div><Label>Lugar</Label><Input value={manual.lugar} onChange={(e) => setManual({ ...manual, lugar: e.target.value })} placeholder="Chile, Valparaíso" /></div>
            <div><Label>Años aprox.</Label><Input value={manual.anos} onChange={(e) => setManual({ ...manual, anos: e.target.value })} placeholder="1900-1930" /></div>
            <div className="sm:col-span-2"><Label>Palabras clave</Label><Input value={manual.palabras} onChange={(e) => setManual({ ...manual, palabras: e.target.value })} placeholder="origen italiano, inmigración, marina mercante…" /></div>
            <div className="sm:col-span-2">
              <Button size="lg" className="w-full" onClick={ejecutar} disabled={busy}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />} Buscar con IA
              </Button>
            </div>
          </div>
        )}
        {tab === "url" && (
          <div className="space-y-3">
            <Label>URL de página a analizar</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            <p className="text-xs text-muted-foreground">La IA leerá la página, extraerá nombres, fechas y lugares, y comparará con tu árbol.</p>
            <Button size="lg" className="w-full" onClick={ejecutar} disabled={busy || !url}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />} Analizar con IA
            </Button>
          </div>
        )}
      </GlassCard>

      {/* Resultados */}
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{hallazgos.length ? "Resultados de esta búsqueda" : "Últimos hallazgos"}</h2>
      {lista.length === 0 ? (
        <EmptyState icon={<Sparkles className="h-5 w-5" />} title="Sin hallazgos aún" description="Lanza una búsqueda para ver resultados." />
      ) : (
        <div className="space-y-2">
          {lista.map((h, i) => (
            <GlassCard key={h.id ?? i} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={confColor(h.confianza) as any}>Confianza {h.confianza}</Badge>
                    {h.fuente && <span className="text-xs text-muted-foreground">{h.fuente}</span>}
                    {h.estado && h.estado !== "pendiente" && <Badge variant="outline" className="text-[10px]">{h.estado}</Badge>}
                  </div>
                  <h3 className="mt-1 font-semibold">{h.titulo}</h3>
                  {h.resumen && <p className="mt-1 text-sm text-muted-foreground">{h.resumen}</p>}
                  {h.motivo && <p className="mt-1 text-xs"><b>Posible relación:</b> {h.motivo}</p>}
                  <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                    {(h.personas ?? []).slice(0, 6).map((n: string, k: number) => <span key={k} className="rounded bg-primary/10 px-1.5 py-0.5">{n}</span>)}
                    {(h.fechas ?? []).slice(0, 4).map((d: string, k: number) => <span key={k} className="rounded bg-muted px-1.5 py-0.5">{d}</span>)}
                    {(h.lugares ?? []).slice(0, 4).map((l: string, k: number) => <span key={k} className="rounded bg-accent/40 px-1.5 py-0.5">{l}</span>)}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {h.url && (
                  <a href={h.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                    Abrir <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {h.persona_id && <Link to={`/personas/${h.persona_id}`} className="text-xs text-link hover:underline">Ver persona →</Link>}
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => actuar(h.id, "aceptada")}><Check className="h-3.5 w-3.5" /> Confirmar</Button>
                  <Button size="sm" variant="outline" onClick={() => actuar(h.id, "hipotesis")}><Lightbulb className="h-3.5 w-3.5" /> Hipótesis</Button>
                  <Button size="sm" variant="ghost" onClick={() => actuar(h.id, "rechazada")}><X className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
