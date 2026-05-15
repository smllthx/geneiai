import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline } from "react-leaflet";
import { supabase } from "@/integrations/supabase/client";
import "leaflet/dist/leaflet.css";

type Lugar = { id: string; ciudad: string | null; pais: string | null; lat: number | null; lng: number | null };

export default function MigrationMap({ height = 320 }: { height?: number }) {
  const [puntos, setPuntos] = useState<Array<{ lat: number; lng: number; label: string; count: number }>>([]);
  const [rutas, setRutas] = useState<Array<[[number, number], [number, number]]>>([]);

  useEffect(() => {
    (async () => {
      const { data: lugares } = await supabase.from("lugares").select("id,ciudad,pais,lat,lng");
      const byId = new Map<string, Lugar>();
      (lugares ?? []).forEach((l) => byId.set(l.id, l as Lugar));

      const { data: personas } = await supabase
        .from("personas")
        .select("nac_lugar_id,defuncion_lugar_id");

      const count = new Map<string, { lat: number; lng: number; label: string; count: number }>();
      const lineas: Array<[[number, number], [number, number]]> = [];

      (personas ?? []).forEach((p: any) => {
        const a = p.nac_lugar_id ? byId.get(p.nac_lugar_id) : null;
        const b = p.defuncion_lugar_id ? byId.get(p.defuncion_lugar_id) : null;
        [a, b].forEach((x) => {
          if (!x?.lat || !x?.lng) return;
          const k = `${x.lat},${x.lng}`;
          const prev = count.get(k);
          count.set(k, {
            lat: x.lat, lng: x.lng,
            label: [x.ciudad, x.pais].filter(Boolean).join(", ") || "Lugar",
            count: (prev?.count ?? 0) + 1,
          });
        });
        if (a?.lat && a?.lng && b?.lat && b?.lng && (a.lat !== b.lat || a.lng !== b.lng)) {
          lineas.push([[a.lat, a.lng], [b.lat, b.lng]]);
        }
      });
      setPuntos([...count.values()]);
      setRutas(lineas);
    })();
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl" style={{ height }}>
      <MapContainer center={[20, 0]} zoom={2} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {rutas.map((r, i) => (
          <Polyline key={i} positions={r} pathOptions={{ color: "hsl(280, 90%, 60%)", weight: 1.5, opacity: 0.5, dashArray: "4 6" }} />
        ))}
        {puntos.map((p, i) => (
          <CircleMarker key={i} center={[p.lat, p.lng]} radius={Math.min(4 + p.count * 2, 14)}
            pathOptions={{ color: "hsl(211, 100%, 50%)", fillColor: "hsl(211, 100%, 50%)", fillOpacity: 0.55, weight: 1 }}>
            <Tooltip>{p.label} · {p.count}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
