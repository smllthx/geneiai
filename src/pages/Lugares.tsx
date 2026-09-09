import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import LugarSelect, { lugarLabel, type Lugar } from "@/components/LugarSelect";

export default function Lugares() {
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [d, setD] = useState<any>({ pais: "", region: "", provincia: "", ciudad: "", parroquia: "", archivo: "" });
  const load = async () => { const { data } = await supabase.from("lugares").select("*").order("pais"); setItems(data ?? []); };
  useEffect(() => { load(); }, []);
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
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {items.filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng)).map((l) => (
              <CircleMarker key={l.id} center={[l.lat, l.lng]} radius={7} pathOptions={{ color: "#0e7490", fillColor: "#22d3ee", fillOpacity: 0.72 }}>
                <Popup>{lugarLabel(l as Lugar) || l.nombre || "Lugar"}{l.parroquia ? ` · ${l.parroquia}` : ""}</Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </div>
      <Card className="archivo-card mb-6"><CardContent className="grid gap-2 pt-6 md:grid-cols-3">
        {["pais","region","provincia","ciudad","parroquia","archivo"].map((k) =>
          <Input key={k} placeholder={k} value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} />)}
        <Button onClick={add}>Añadir lugar</Button>
      </CardContent></Card>
      <div className="grid gap-2">{items.map((l) => (
        <Card key={l.id} className="archivo-card"><CardContent className="flex items-center justify-between pt-4 text-sm">
          <span>{[l.ciudad, l.provincia, l.region, l.pais].filter(Boolean).join(", ")}{l.parroquia && ` · ${l.parroquia}`}</span>
          <Button size="sm" variant="ghost" onClick={() => del(l.id)}><Trash2 className="h-4 w-4" /></Button>
        </CardContent></Card>
      ))}</div>
    </div>
  );
}
