import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, GlassCard, EmptyState } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dna, Plus, AlertTriangle, Trash2, List, Map as MapIcon, Upload, Sparkles, GitBranch, FlaskConical, Calculator, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { findRegion } from "@/lib/dna-regions";
import { guardarEtnicidadArbol } from "@/lib/etnicidadArbol";

const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6", "#a855f7", "#3b82f6"];

type DraftRegion = { region: string; porcentaje: number };
type ImportDraft = { fuente: string; rows: DraftRegion[]; warnings: string[] };
type Tipo = "todos" | "arbol" | "adn";

function tipoDe(fuente: string | null): "arbol" | "adn" {
  const f = (fuente ?? "").toLowerCase();
  if (f.startsWith("adn · ") || f === "manual (adn)") return "adn";
  if (f.includes("árbol") || f.includes("arbol") || f.includes("genealóg") || f.includes("genealog") || f.includes("manual")) return "arbol";
  return "adn";
}

export default function ADN({ ethnicity = false }: { ethnicity?: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState("");
  const [pct, setPct] = useState("");
  const [fuente, setFuente] = useState("");
  const [rama, setRama] = useState("");
  const [origenTipo, setOrigenTipo] = useState<"arbol" | "adn">(ethnicity ? "adn" : "arbol");
  const [vista, setVista] = useState<"lista" | "mapa">("lista");
  const [summaryFilter, setFiltro] = useState<Tipo>("todos");
  const filtro = ethnicity ? "adn" : summaryFilter;
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [importando, setImportando] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from("dna_estimates").select("*").order("porcentaje", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener("genaia:origin-updated", refresh);
    return () => window.removeEventListener("genaia:origin-updated", refresh);
  }, []);

  const calcularPorArbol = async () => {
    setSyncing(true);
    const t = toast.loading("Calculando origen documental por árbol…");
    try {
      const { data: prof } = await supabase.from("profiles").select("proband_id").maybeSingle();
      let probandId = prof?.proband_id;
      if (!probandId) {
        const { data: ps } = await supabase.from("personas").select("id,nac_fecha").order("nac_fecha", { ascending: false }).limit(1);
        probandId = ps?.[0]?.id;
      }
      if (!probandId) { toast.dismiss(t); return toast.error("Crea al menos una persona primero"); }
      const res = await guardarEtnicidadArbol(probandId);
      toast.dismiss(t);
      toast.success(`Origen actualizado: ${res.insertados} regiones · cobertura ${Math.round(res.cobertura * 100)}%`);
      load();
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e.message ?? "Error");
    } finally {
      setSyncing(false);
    }
  };

  const agregar = async () => {
    const user = (await supabase.auth.getUser()).data.user!;
    const fuenteFinal = fuente || (!ethnicity && origenTipo === "arbol" ? "Cálculo por árbol" : "Manual (ADN)");
    const { error } = await supabase.from("dna_estimates").insert({
      user_id: user.id, region, porcentaje: parseFloat(pct) || 0, fuente: fuenteFinal, rama,
    });
    if (error) return toast.error(error.message);
    toast.success("Origen agregado");
    setOpen(false); setRegion(""); setPct(""); setFuente(""); setRama(""); load();
  };

  const importarArchivo = async (file: File) => {
    setImportando(true);
    const t = toast.loading(`Leyendo ${file.name}…`);
    try {
      if (!/\.(txt|csv|json|html?)$/i.test(file.name) || file.type === "application/pdf" || (await file.slice(0, 5).text()) === "%PDF-") {
        throw new Error("Usa un informe TXT, CSV, JSON o HTML con las regiones y sus porcentajes.");
      }
      const texto = await file.text();
      if (!texto.trim()) throw new Error("El archivo está vacío.");
      const { data, error } = await supabase.functions.invoke("parsear-dna", {
        body: { texto },
      });
      toast.dismiss(t);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.persistido !== false || !Array.isArray(data.items)) throw new Error("El servicio no devolvió un borrador revisable.");
      const rows = data.items.filter((row: DraftRegion) => typeof row?.region === "string" && Number.isFinite(row.porcentaje) && row.porcentaje > 0 && row.porcentaje <= 100);
      if (!rows.length) throw new Error("No se encontraron regiones con porcentajes en el informe.");
      setDraft({ fuente: `ADN · ${file.name}`, rows, warnings: Array.isArray(data.advertencias) ? data.advertencias.filter((v: unknown) => typeof v === "string") : [] });
    } catch (e: any) { toast.dismiss(t); toast.error(e.message ?? "Error"); }
    finally { setImportando(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const saveDraft = async () => {
    if (!draft?.rows.length || savingDraft) return;
    setSavingDraft(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión requerida.");
      const { error } = await supabase.from("dna_estimates").insert(draft.rows.map(({ region, porcentaje }) => ({
        user_id: user.id, region, porcentaje, fuente: draft.fuente,
      })));
      if (error) throw error;
      toast.success(`${draft.rows.length} regiones guardadas`);
      setDraft(null);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar el informe."); }
    finally { setSavingDraft(false); }
  };

  const itemsFiltrados = useMemo(() => {
    if (filtro === "todos") return items;
    return items.filter((i) => tipoDe(i.fuente) === filtro);
  }, [items, filtro]);

  const total = itemsFiltrados.reduce((s, i) => s + Number(i.porcentaje), 0);

  const arbolItems = items.filter((i) => tipoDe(i.fuente) === "arbol");
  const adnItems = items.filter((i) => tipoDe(i.fuente) === "adn");
  const arbolTotal = arbolItems.reduce((s, i) => s + Number(i.porcentaje), 0);
  const adnTotal = adnItems.reduce((s, i) => s + Number(i.porcentaje), 0);

  const sameSource = new Set(itemsFiltrados.map(item => item.fuente)).size <= 1;
  const dataPie = useMemo(() => {
    return itemsFiltrados.map((i) => ({ name: i.region, value: Number(i.porcentaje), fuente: i.fuente }));
  }, [itemsFiltrados]);

  const mapPoints = itemsFiltrados
    .map((i) => ({ ...i, geo: findRegion(i.region) }))
    .filter((i) => i.geo);
  const unknownCount = itemsFiltrados.length - mapPoints.length;

  return (
    <div>
      <SectionHeader
        eyebrow="ADN y origen ancestral"
        title={ethnicity ? "Estimación Étnica" : "Resumen de ADN"}
        subtitle={ethnicity ? "Explora las regiones y porcentajes que guardaste de tus pruebas de ADN." : "Consulta tus informes de ADN y los lugares de nacimiento registrados en tu árbol."}
        actions={
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".txt,.csv,.json,.html,.htm"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importarArchivo(f); }}
            />
            <Button variant="outline" aria-describedby="dna-import-formats" disabled={importando} onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Importar test ADN
            </Button>
            {!ethnicity && <Button variant="outline" disabled={syncing} onClick={calcularPorArbol}>
              {syncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />} Recalcular árbol
            </Button>}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Nuevo origen</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Agregar origen estimado</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Tipo</Label>
                    <div className="mt-1 flex gap-2">
                      <Button disabled={ethnicity} size="sm" variant={origenTipo === "arbol" ? "default" : "outline"} onClick={() => setOrigenTipo("arbol")}>
                        <GitBranch className="h-3.5 w-3.5" /> Por árbol
                      </Button>
                      <Button size="sm" variant={origenTipo === "adn" ? "default" : "outline"} onClick={() => setOrigenTipo("adn")}>
                        <FlaskConical className="h-3.5 w-3.5" /> Por ADN
                      </Button>
                    </div>
                  </div>
                  <div><Label>Región / etnia</Label><Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Italia (Liguria)" /></div>
                  <div><Label>Porcentaje</Label><Input type="number" step="0.01" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="42.5" /></div>
                  <div><Label>Fuente (opcional)</Label><Input value={fuente} onChange={(e) => setFuente(e.target.value)} placeholder={origenTipo === "arbol" ? "Cálculo por árbol" : "MyHeritage DNA"} /></div>
                  <div><Label>Rama familiar (opcional)</Label><Input value={rama} onChange={(e) => setRama(e.target.value)} placeholder="Paterna / Materna / apellido" /></div>
                  <Button onClick={agregar} disabled={!region || !pct}>Agregar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Dialog open={!!draft} onOpenChange={open => { if (!open && !savingDraft) setDraft(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Revisar regiones del informe</DialogTitle></DialogHeader>
          <p className="text-sm">{draft?.fuente}</p>
          {draft?.warnings.map((message, i) => <p key={i} className="text-sm text-muted-foreground">{message}</p>)}
          <ul className="max-h-[40dvh] space-y-2 overflow-y-auto">
            {draft?.rows.map((row, index) => <li key={index} className="flex items-center gap-2">
              <span className="flex-1">{row.region}</span><span>{row.porcentaje}%</span>
              <Button variant="ghost" size="sm" aria-label={`Excluir ${row.region}`} disabled={savingDraft} onClick={() => setDraft({ ...draft, rows: draft.rows.filter((_, i) => i !== index) })}>Excluir</Button>
            </li>)}
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={savingDraft} onClick={() => setDraft(null)}>Cancelar</Button>
            <Button disabled={savingDraft || !draft?.rows.length} onClick={saveDraft}>{savingDraft ? "Guardando…" : "Guardar regiones"}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <p id="dna-import-formats" className="mb-3 text-xs text-muted-foreground">Importa regiones y porcentajes desde TXT, CSV, JSON o HTML. Si tu informe es PDF, copia esos datos a un archivo TXT.</p>
      <Alert className="mb-4 border-accent/30 bg-accent/5">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Estimación referencial</AlertTitle>
        <AlertDescription>
          El origen documental se calcula con los lugares de nacimiento del árbol. Los porcentajes de ADN provienen de los informes que importas.
        </AlertDescription>
      </Alert>

      {!ethnicity && <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <GlassCard className="text-center">
          <GitBranch className="mx-auto mb-1 h-5 w-5 text-primary" />
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Por árbol genealógico</div>
          <div className="font-display text-3xl font-bold">{arbolTotal.toFixed(1)}%</div>
          <div className="text-xs text-muted-foreground">{arbolItems.length} regiones</div>
        </GlassCard>
        <GlassCard className="text-center">
          <FlaskConical className="mx-auto mb-1 h-5 w-5 text-accent" />
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Por ADN</div>
          <div className="font-display text-3xl font-bold">{adnTotal.toFixed(1)}%</div>
          <div className="text-xs text-muted-foreground">{adnItems.length} regiones</div>
        </GlassCard>
      </div>}

      <div className="mb-4 flex flex-wrap gap-2">
        {!ethnicity && (["todos", "arbol", "adn"] as Tipo[]).map((t) => (
          <Button key={t} size="sm" variant={filtro === t ? "default" : "outline"} onClick={() => setFiltro(t)}>
            {t === "todos" ? "Todos" : t === "arbol" ? "Por árbol" : "Por ADN"}
          </Button>
        ))}
        <span className="ml-auto self-center text-xs text-muted-foreground">{sameSource ? `Total de la fuente: ${total.toFixed(1)}%` : `${itemsFiltrados.length} regiones de varias fuentes`}</span>
        <Button variant={vista === "lista" ? "default" : "outline"} size="sm" onClick={() => setVista("lista")}>
          <List className="h-4 w-4" /> Lista
        </Button>
        <Button variant={vista === "mapa" ? "default" : "outline"} size="sm" onClick={() => setVista("mapa")}>
          <MapIcon className="h-4 w-4" /> Mapa
        </Button>
      </div>

      {itemsFiltrados.length === 0 ? (
        <EmptyState icon={<Dna className="h-5 w-5" />} title="Sin estimaciones"
          description="Importa tu test de ADN o agrega manualmente las regiones por rama." />
      ) : (
        <>
          {dataPie.length > 0 && sameSource && (
            <GlassCard className="mb-4">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-serif text-base font-semibold">{filtro === "arbol" ? "Distribución documental" : "Distribución por región"}</span>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dataPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2}>
                      {dataPie.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <ReTooltip formatter={(v: any, n: any) => [`${Number(v).toFixed(1)}%`, n]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs sm:grid-cols-3">
                {dataPie.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5 truncate">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="truncate">{d.name}</span>
                    <span className="ml-auto text-muted-foreground">{Number(d.value).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {vista === "mapa" ? (
            <GlassCard padded={false} className="overflow-hidden">
              <div className="h-[60vh] min-h-[400px] w-full">
                <MapContainer center={[30, 10]} zoom={2} className="h-full w-full" scrollWheelZoom>
                  <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {mapPoints.map((i) => (
                    <CircleMarker
                      key={i.id}
                      center={[i.geo!.lat, i.geo!.lng]}
                      radius={Math.max(8, Math.min(50, Number(i.porcentaje) * 1.2))}
                      pathOptions={{
                        color: tipoDe(i.fuente) === "arbol" ? "#6366f1" : "#10b981",
                        fillColor: tipoDe(i.fuente) === "arbol" ? "#6366f1" : "#10b981",
                        fillOpacity: Math.min(0.65, 0.15 + Number(i.porcentaje) / 100),
                        weight: 1.5,
                      }}
                    >
                      <Tooltip direction="top" offset={[0, -8]}>
                        <strong>{i.region}</strong> — {Number(i.porcentaje).toFixed(1)}%
                        <br />{tipoDe(i.fuente) === "arbol" ? "Por árbol" : "Por ADN"}
                        {i.rama ? <><br />Rama: {i.rama}</> : null}
                      </Tooltip>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
              {unknownCount > 0 && (
                <p className="px-4 py-2 text-xs text-muted-foreground">
                  {unknownCount} región(es) sin ubicación conocida no se muestran en el mapa.
                </p>
              )}
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {itemsFiltrados.map((i, idx) => (
                <GlassCard key={i.id} padded={false} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PALETTE[idx % PALETTE.length] }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium">{i.region}</span>
                        <span className="font-display text-lg font-semibold">{Number(i.porcentaje).toFixed(1)}%</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-foreground/5">
                        <div className="h-full rounded-full" style={{
                          width: `${Math.min(100, Number(i.porcentaje))}%`,
                          background: PALETTE[idx % PALETTE.length],
                        }} />
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-foreground/5 px-1.5 py-0.5">
                          {tipoDe(i.fuente) === "arbol" ? "Árbol" : "ADN"}
                        </span>
                        {i.rama && <span>Rama: {i.rama}</span>}
                        {i.fuente && <span>Fuente: {i.fuente}</span>}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={async () => {
                      await supabase.from("dna_estimates").delete().eq("id", i.id);
                      load();
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
