import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, GlassCard, EmptyState } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dna, Plus, AlertTriangle, Trash2, List, Map as MapIcon } from "lucide-react";
import { toast } from "sonner";
import { findRegion } from "@/lib/dna-regions";

export default function ADN() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState("");
  const [pct, setPct] = useState("");
  const [fuente, setFuente] = useState("");
  const [rama, setRama] = useState("");
  const [vista, setVista] = useState<"lista" | "mapa">("lista");

  const load = async () => {
    const { data } = await supabase.from("dna_estimates").select("*").order("porcentaje", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const agregar = async () => {
    const user = (await supabase.auth.getUser()).data.user!;
    const { error } = await supabase.from("dna_estimates").insert({
      user_id: user.id, region, porcentaje: parseFloat(pct) || 0, fuente, rama,
    });
    if (error) return toast.error(error.message);
    toast.success("Origen agregado");
    setOpen(false); setRegion(""); setPct(""); setFuente(""); setRama(""); load();
  };

  const total = items.reduce((s, i) => s + Number(i.porcentaje), 0);
  const mapPoints = items
    .map((i) => ({ ...i, geo: findRegion(i.region) }))
    .filter((i) => i.geo);
  const unknownCount = items.length - mapPoints.length;

  return (
    <div>
      <SectionHeader
        eyebrow="Origen estimado"
        title="ADN / Estimación étnica"
        subtitle="Pega tus resultados de tests externos (MyHeritage, AncestryDNA, 23andMe) o registra estimaciones por rama familiar."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Nuevo origen</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Agregar origen estimado</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Región / etnia</Label><Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Italia (Liguria)" /></div>
                <div><Label>Porcentaje</Label><Input type="number" step="0.01" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="42.5" /></div>
                <div><Label>Fuente</Label><Input value={fuente} onChange={(e) => setFuente(e.target.value)} placeholder="MyHeritage DNA / cálculo manual" /></div>
                <div><Label>Rama familiar (opcional)</Label><Input value={rama} onChange={(e) => setRama(e.target.value)} placeholder="Paterna / Materna / Sanguineti" /></div>
                <Button onClick={agregar} disabled={!region || !pct}>Agregar</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Alert className="mb-4 border-accent/30 bg-accent/5">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Estimación referencial</AlertTitle>
        <AlertDescription>
          No es un diagnóstico ni una prueba genética oficial. Los porcentajes son aproximaciones.
        </AlertDescription>
      </Alert>

      <div className="mb-4 flex gap-2">
        <Button variant={vista === "lista" ? "default" : "outline"} size="sm" onClick={() => setVista("lista")}>
          <List className="h-4 w-4" /> Lista
        </Button>
        <Button variant={vista === "mapa" ? "default" : "outline"} size="sm" onClick={() => setVista("mapa")}>
          <MapIcon className="h-4 w-4" /> Mapa
        </Button>
        <span className="ml-auto text-xs text-muted-foreground self-center">Total: {total.toFixed(1)}%</span>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<Dna className="h-5 w-5" />} title="Sin estimaciones"
          description="Agrega los porcentajes de tu test de ADN o estima manualmente por rama." />
      ) : vista === "mapa" ? (
        <GlassCard padded={false} className="overflow-hidden">
          <div className="h-[60vh] min-h-[400px] w-full">
            <MapContainer center={[30, 10]} zoom={2} className="h-full w-full" scrollWheelZoom>
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {mapPoints.map((i) => (
                <CircleMarker
                  key={i.id}
                  center={[i.geo!.lat, i.geo!.lng]}
                  radius={Math.max(8, Math.min(50, Number(i.porcentaje) * 1.2))}
                  pathOptions={{
                    color: "hsl(var(--primary))",
                    fillColor: "hsl(var(--primary))",
                    fillOpacity: Math.min(0.65, 0.15 + Number(i.porcentaje) / 100),
                    weight: 1.5,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -8]}>
                    <strong>{i.region}</strong> — {Number(i.porcentaje).toFixed(1)}%
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
          {items.map((i) => (
            <GlassCard key={i.id} padded={false} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{i.region}</span>
                    <span className="font-display text-lg font-semibold">{Number(i.porcentaje).toFixed(1)}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-foreground/5">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${Math.min(100, Number(i.porcentaje))}%` }} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
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
    </div>
  );
}
