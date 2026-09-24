import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Laptop, Smartphone, Tablet } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import BrandLogo from "@/components/BrandLogo";
import AppearancePicker from "@/components/AppearancePicker";
import DashboardView, { type DashboardProps } from "@/components/home/DashboardView";
import { applyAppearance, getAppearance, subscribeAppearance } from "@/lib/appearance";

// Deliberately fictional and independent of any signed-in account or database.
const people = [
  { id: "demo-elena", nombres: "Elena", apellidos: "Ríos Martínez" },
  { id: "demo-antonio", nombres: "Antonio", apellidos: "Vega Rossi" },
  { id: "demo-isabel", nombres: "Isabel", apellidos: "Martínez Costa" },
  { id: "demo-rafael", nombres: "Rafael", apellidos: "Ríos Fernández" },
];
const example: DashboardProps = {
  stats: { personas: 2014, lugares: 754, fotos: 186, totalApellidos: 48, docsPendientes: 3, coincidencias: 2, hipotesis: 1, inferencias: 0, apellidos: ["Ríos", "Martínez", "Vega", "Rossi", "Costa", "Fernández"] },
  recientes: people, vistasRecientes: [], sinPadres: people.slice(0, 2), sinFotos: people.slice(2),
  actividad: [{ id: "example-activity", descripcion: "Documento añadido al archivo de ejemplo", created_at: "2026-09-24T12:00:00Z" }],
  map: <p className="home-empty">En tu archivo, aquí se abre el mapa de los lugares registrados.</p>,
  timeline: <p className="home-empty">En tu archivo, aquí aparecen los eventos de tu familia.</p>,
};
const devices = {
  iphone: { label: "iPhone", width: 393, height: 852, icon: Smartphone },
  ipad: { label: "iPad", width: 1024, height: 900, icon: Tablet },
  mac: { label: "Mac", width: 1440, height: 1000, icon: Laptop },
};
type Device = keyof typeof devices;

export default function DesignPreview() {
  const [params, setParams] = useSearchParams();
  const canvas = params.get("canvas") === "1";
  const requested = params.get("device");
  const device: Device = requested === "iphone" || requested === "ipad" ? requested : "mac";
  const installed = params.get("mode") === "app";
  const appearance = useSyncExternalStore(subscribeAppearance, getAppearance, () => "system" as const);
  const stageRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(1100);
  const size = devices[device];
  const scale = Math.min(1, availableWidth / size.width);
  useEffect(() => {
    if (canvas) { applyAppearance(); return; }
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(Math.max(280, entry.contentRect.width - 24)));
    observer.observe(stage);
    return () => observer.disconnect();
  }, [canvas]);

  if (canvas) return <AppLayout preview><DashboardView {...example} /></AppLayout>;

  const changeDevice = (value: Device) => setParams({ device: value, mode: installed ? "app" : "web" });
  return <div className="design-gallery">
    <header className="design-gallery-header"><BrandLogo showText size={36} /><Link to="/inicio">Abrir mi archivo <ArrowUpRight size={15} /></Link></header>
    <div className="design-gallery-heading"><p className="home-eyebrow">GENEAI · Nuevo diseño</p><h1>Tu historia. En cada pantalla.</h1><p>Una interfaz adaptable, con luz, profundidad y espacio para lo que importa.</p></div>
    <div className="design-gallery-controls">
      <div className="design-device-picker" role="group" aria-label="Dispositivo">{Object.entries(devices).map(([key, item]) => <button key={key} type="button" aria-pressed={device === key} onClick={() => changeDevice(key as Device)}><item.icon size={18} />{item.label}</button>)}</div>
      <div className="design-mode-picker" role="group" aria-label="Versión"><button aria-pressed={!installed} onClick={() => setParams({ device, mode: "web" })}>Navegador</button><button aria-pressed={installed} onClick={() => setParams({ device, mode: "app" })}>App web</button></div>
      <AppearancePicker />
    </div>
    <p className="design-example-note">Vista de diseño con datos ficticios. Los accesos del archivo requieren iniciar sesión.</p>
    <div className="design-stage" ref={stageRef}>
      <div className={`design-device-frame design-device-${device}`} style={{ width: size.width * scale, height: (size.height + (installed ? 0 : 40)) * scale }}>
        <div style={{ width: size.width, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {!installed && <div className="design-browser-chrome"><span /><span /><span /><div>geneiai.vercel.app</div><ArrowUpRight size={14} /></div>}
          <iframe key={`${device}-${installed}-${appearance}`} title={`GENEAI en ${size.label}, ${installed ? "app web" : "navegador"}`} src={`/diseno?canvas=1&device=${device}&mode=${installed ? "app" : "web"}`} width={size.width} height={size.height} />
        </div>
      </div>
    </div>
    <footer className="design-gallery-footer"><p>{size.label} · {size.width} × {size.height} · {installed ? "App web instalada (PWA)" : "Web en navegador"}</p><p>Previsualización del diseño responsive. Las barras del sistema y las áreas seguras varían en el dispositivo real.</p></footer>
  </div>;
}
