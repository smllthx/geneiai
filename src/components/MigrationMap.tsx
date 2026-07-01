import { useEffect, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Marker, Tooltip, Polyline } from "react-leaflet";
import { supabase } from "@/integrations/supabase/client";
import "leaflet/dist/leaflet.css";

type Lugar = { id: string; ciudad: string | null; pais: string | null; lat: number | null; lng: number | null };
type LatLng = [number, number];
type EventoTipo =
  | "nacimiento" | "bautismo" | "matrimonio" | "defuncion" | "entierro"
  | "residencia" | "censo" | "inmigracion" | "viaje" | "ocupacion" | "otro";

type EventMarker = {
  lat: number;
  lng: number;
  tipo: EventoTipo;
  label: string;
  fecha?: string | null;
  lugar: string;
};

const EVENT_STYLE: Record<EventoTipo, { symbol: string; color: string; label: string }> = {
  nacimiento: { symbol: "✦", color: "#39bdf8", label: "Nacimiento" },
  bautismo: { symbol: "≈", color: "#67e8f9", label: "Bautismo / rito" },
  matrimonio: { symbol: "∞", color: "#f5c84c", label: "Matrimonio / unión" },
  defuncion: { symbol: "✝", color: "#a78bfa", label: "Defunción" },
  entierro: { symbol: "▣", color: "#c4b5fd", label: "Entierro" },
  inmigracion: { symbol: "⛵", color: "#fb923c", label: "Inmigración" },
  viaje: { symbol: "↗", color: "#f97316", label: "Viaje / traslado" },
  residencia: { symbol: "⌂", color: "#34d399", label: "Residencia" },
  censo: { symbol: "▤", color: "#60a5fa", label: "Censo / padrón" },
  ocupacion: { symbol: "⚒", color: "#94a3b8", label: "Ocupación" },
  otro: { symbol: "•", color: "#e5e7eb", label: "Otro hecho" },
};

function placeLabel(lugar?: Lugar | null) {
  return [lugar?.ciudad, lugar?.pais].filter(Boolean).join(", ") || "Lugar";
}

function samePoint(a: Lugar, b: Lugar) {
  return a.lat === b.lat && a.lng === b.lng;
}

function normalizeCountry(input?: string | null) {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function historicSeaRoute(from: Lugar, to: Lugar): LatLng[] {
  if (!from.lat || !from.lng || !to.lat || !to.lng) return [];
  const start: LatLng = [from.lat, from.lng];
  const end: LatLng = [to.lat, to.lng];
  const fromCountry = normalizeCountry(from.pais);
  const toCountry = normalizeCountry(to.pais);
  const fromEurope = /(italia|suiza|espana|francia|alemania|austria|yugoslavia|croacia|slovenia|serbia|europa)/.test(fromCountry);
  const toChile = /chile/.test(toCountry);
  const toArgentina = /argentina/.test(toCountry);
  const toAmerica = /(chile|argentina|uruguay|brasil|peru|america)/.test(toCountry);

  if (!fromEurope || !toAmerica) return [start, end];

  const atlantic: LatLng[] = [
    [36.1408, -5.3536],   // Gibraltar
    [28.2916, -16.6291],  // Canarias
    [-8.0476, -34.8770],  // Recife
    [-22.9068, -43.1729], // Rio de Janeiro
    [-34.9011, -56.1645], // Montevideo
  ];
  if (toArgentina) return [start, ...atlantic, [-34.6037, -58.3816], end];
  if (toChile) return [start, ...atlantic, [-34.6037, -58.3816], [-53.1638, -70.9171], [-33.0472, -71.6127], end];
  return [start, ...atlantic, end];
}

function eventIcon(tipo: EventoTipo) {
  const style = EVENT_STYLE[tipo] ?? EVENT_STYLE.otro;
  return L.divIcon({
    className: "",
    html: `<span style="
      display:grid;place-items:center;width:28px;height:28px;border-radius:999px;
      background:${style.color};color:#071114;border:2px solid rgba(255,255,255,.9);
      box-shadow:0 8px 20px rgba(0,0,0,.24);font-weight:800;font-size:14px;
    ">${style.symbol}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export default function MigrationMap({ height = 320 }: { height?: number }) {
  const [puntos, setPuntos] = useState<Array<{ lat: number; lng: number; label: string; count: number }>>([]);
  const [eventos, setEventos] = useState<EventMarker[]>([]);
  const [rutas, setRutas] = useState<Array<{ points: LatLng[]; label: string; maritime?: boolean }>>([]);

  useEffect(() => {
    (async () => {
      const { data: lugares } = await supabase.from("lugares").select("id,ciudad,pais,lat,lng");
      const byId = new Map<string, Lugar>();
      (lugares ?? []).forEach((l) => byId.set(l.id, l as Lugar));

      const { data: personas } = await supabase
        .from("personas")
        .select("id,nombres,apellidos,nac_lugar_id,defuncion_lugar_id");
      const { data: hechos } = await supabase
        .from("eventos")
        .select("id,tipo,fecha,fecha_aprox,descripcion,lugar_id,persona_id")
        .limit(1000);

      const count = new Map<string, { lat: number; lng: number; label: string; count: number }>();
      const lineas: Array<{ points: LatLng[]; label: string; maritime?: boolean }> = [];
      const marks: EventMarker[] = [];
      const personById = new Map<string, any>();
      (personas ?? []).forEach((p: any) => personById.set(p.id, p));

      (personas ?? []).forEach((p: any) => {
        const a = p.nac_lugar_id ? byId.get(p.nac_lugar_id) : null;
        const b = p.defuncion_lugar_id ? byId.get(p.defuncion_lugar_id) : null;
        [a, b].forEach((x) => {
          if (!x?.lat || !x?.lng) return;
          const k = `${x.lat},${x.lng}`;
          const prev = count.get(k);
          count.set(k, {
            lat: x.lat, lng: x.lng,
            label: placeLabel(x),
            count: (prev?.count ?? 0) + 1,
          });
        });
        if (a?.lat && a?.lng && b?.lat && b?.lng && !samePoint(a, b)) {
          const personName = [p.nombres, p.apellidos].filter(Boolean).join(" ") || "Persona";
          lineas.push({
            points: historicSeaRoute(a, b),
            label: `${personName}: ${placeLabel(a)} → ${placeLabel(b)}`,
            maritime: normalizeCountry(a.pais) !== normalizeCountry(b.pais),
          });
        }
      });

      (hechos ?? []).forEach((event: any) => {
        const lugar = event.lugar_id ? byId.get(event.lugar_id) : null;
        if (!lugar?.lat || !lugar?.lng) return;
        const tipo = (EVENT_STYLE[event.tipo as EventoTipo] ? event.tipo : "otro") as EventoTipo;
        const persona = event.persona_id ? personById.get(event.persona_id) : null;
        const personName = [persona?.nombres, persona?.apellidos].filter(Boolean).join(" ") || "Persona";
        marks.push({
          lat: lugar.lat,
          lng: lugar.lng,
          tipo,
          label: `${EVENT_STYLE[tipo].label} · ${personName}`,
          fecha: event.fecha || event.fecha_aprox,
          lugar: placeLabel(lugar),
        });

        if ((tipo === "inmigracion" || tipo === "viaje") && persona?.nac_lugar_id) {
          const from = byId.get(persona.nac_lugar_id);
          if (from?.lat && from?.lng && !samePoint(from, lugar)) {
            lineas.push({
              points: historicSeaRoute(from, lugar),
              label: `${personName}: ${EVENT_STYLE[tipo].label.toLowerCase()} ${placeLabel(from)} → ${placeLabel(lugar)}`,
              maritime: true,
            });
          }
        }
      });
      setPuntos([...count.values()]);
      setEventos(marks);
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
          <Polyline
            key={i}
            positions={r.points}
            pathOptions={{ color: r.maritime ? "hsl(28, 95%, 58%)" : "hsl(280, 90%, 60%)", weight: r.maritime ? 2.4 : 1.5, opacity: 0.58, dashArray: r.maritime ? "8 8" : "4 6" }}
          >
            <Tooltip>{r.label}</Tooltip>
          </Polyline>
        ))}
        {puntos.map((p, i) => (
          <CircleMarker key={i} center={[p.lat, p.lng]} radius={Math.min(4 + p.count * 2, 14)}
            pathOptions={{ color: "hsl(211, 100%, 50%)", fillColor: "hsl(211, 100%, 50%)", fillOpacity: 0.55, weight: 1 }}>
            <Tooltip>{p.label} · {p.count}</Tooltip>
          </CircleMarker>
        ))}
        {eventos.map((event, i) => (
          <Marker key={`${event.tipo}-${i}`} position={[event.lat, event.lng]} icon={eventIcon(event.tipo)}>
            <Tooltip>
              {event.label}<br />
              {event.fecha ? `${event.fecha} · ` : ""}{event.lugar}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
