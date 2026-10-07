import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useSearchParams, Link } from "react-router-dom";
import { catalogUrl } from "@/lib/researchSearch";
import { Trash2, ExternalLink, Library, Search } from "lucide-react";
import { toast } from "sonner";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import LugarSelect, { lugarLabel, type Lugar } from "@/components/LugarSelect";

function FocusPlace({ place }: { place?: Lugar & { lat?: number; lng?: number } }) {
  const map = useMap();
  useEffect(() => {
    if (place && Number.isFinite(place.lat) && Number.isFinite(place.lng)) map.setView([place.lat!, place.lng!], 10, { animate: true });
  }, [map, place]);
  return null;
}

export default function Lugares() {
  const [params] = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(params.get("lugar"));
  const [d, setD] = useState<any>({ pais: "", region: "", provincia: "", ciudad: "", parroquia: "", archivo: "" });
  const selectedPlace = items.find(l => l.id === selected);
  const selectedLabel = lugarLabel(selectedPlace);
  const load = async () => { const { data } = await supabase.from("lugares").select("*").order("pais"); setItems(data ?? []); };
  useEffect(() => { load(); }, []);
  useEffect(() => { setSelected(params.get("lugar")); }, [params]);
  const add = async () => {
    const user = (await supabase.auth.getUser()).data.user!;
    const { error } = await supabase.from("lugares").insert({ ...d, user_id: user.id });
    if (error) return toast.error(error.message);
    setD({ pais: "", region: "", provincia: "", ciudad: "", parroquia: "", archivo: "" }); load();
  };
  const del = async (id: string) => { await supabase.from("lugares").delete().eq("id", id); load(); };
  return (
    <div className="space-y-4">
      <PageHeader title="Lugares" subtitle="Un buscador mundial para ciudades, comunas históricas, iglesias, parroquias, cementerios y fuentes del archivo." />
      <div className="archivo-card grid gap-4 p-4 lg:grid-cols-[minmax(0,360px)_1fr]">
        <div>
          <p className="mb-2 text-sm font-semibold">Buscar en el mapa</p>
          <LugarSelect value={selected} onChange={setSelected} lugares={items as Lugar[]} onLugaresChange={setItems} placeholder="Buscar iglesia, parroquia, cementerio o comuna…" />
          <p className="mt-2 text-xs text-muted-foreground">Las sugerencias se consultan bajo demanda en OpenStreetMap y guardan coordenadas para reutilizarlas en fichas, eventos, fotos y mapas.</p>
        </div>
        <div className="h-64 overflow-hidden rounded-2xl border border-border/70 sm:h-72">
          <MapContainer center={[-33.45, -70.66]} zoom={3} scrollWheelZoom className="h-full w-full">
            <FocusPlace place={selectedPlace} />
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {items.filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng)).map((l) => (
              <CircleMarker key={l.id} center={[l.lat, l.lng]} radius={7} pathOptions={{ color: "#0e7490", fillColor: "#22d3ee", fillOpacity: 0.72 }}>
                <Popup>{lugarLabel(l as Lugar) || l.nombre || "Lugar"}{l.parroquia ? ` · ${l.parroquia}` : ""}</Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </div>
      {selectedPlace && <div className="glass-card p-4">
        <p className="font-semibold">{selectedLabel}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <a href={catalogUrl({ place: selectedLabel })} target="_blank" rel="noopener noreferrer" data-external-browser="true" className="inline-flex min-h-11 items-center gap-2 text-sm text-primary"><Library className="h-4 w-4" /> Catálogo de FamilySearch <ExternalLink className="h-3 w-3" /></a>
          <Link to={`/buscar?modo=catalogo&lugar=${encodeURIComponent(selectedLabel)}`} className="inline-flex min-h-11 items-center gap-2 text-sm text-primary"><Search className="h-4 w-4" /> Investigar este lugar</Link>
        </div>
      </div>}
      <Card className="archivo-card mb-6"><CardContent className="grid gap-2 pt-6 md:grid-cols-3">
        {["pais","region","provincia","ciudad","parroquia","archivo"].map((k) =>
          <Input key={k} placeholder={k} value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} />)}
        <Button onClick={add}>Añadir lugar</Button>
      </CardContent></Card>
      <div className="grid gap-2">{items.map((l) => (
        <Card key={l.id} className="archivo-card"><CardContent className="flex items-center justify-between pt-4 text-sm">
          <button type="button" className="min-h-11 text-left" onClick={() => setSelected(l.id)}>{[l.ciudad, l.provincia, l.region, l.pais].filter(Boolean).join(", ")}{l.parroquia && ` · ${l.parroquia}`}</button>
          <Button size="sm" variant="ghost" onClick={() => del(l.id)}><Trash2 className="h-4 w-4" /></Button>
        </CardContent></Card>
      ))}</div>
    </div>
  );
}
