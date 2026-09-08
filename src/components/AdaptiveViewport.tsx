import { useEffect, useState } from "react";
import { useDevice } from "@/hooks/use-device";
import { Settings2, Minus, Plus, RotateCcw, Sun, Moon, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const SCALE_KEY = "genai:ui-scale";
const DENSITY_KEY = "genai:ui-density";
const AUTO_KEY = "genai:ui-auto";
type Density = "compact" | "normal" | "comfortable";
const densityLabels = { compact: "Compacta", normal: "Normal", comfortable: "Cómoda" };

/** Automatic layout preserves readable text; manual preferences stay available. */
export default function AdaptiveViewport() {
  const dev = useDevice();
  const [auto, setAuto] = useState(() => localStorage.getItem(AUTO_KEY) !== "0");
  const [manualScale, setManualScale] = useState(() => Math.min(1.4, Math.max(0.75, Number(localStorage.getItem(SCALE_KEY)) || 1)));
  const [manualDensity, setManualDensity] = useState<Density>(() => {
    const saved = localStorage.getItem(DENSITY_KEY);
    return saved === "compact" || saved === "comfortable" ? saved : "normal";
  });
  const [theme, setTheme] = useState(() => localStorage.getItem("genai:theme") === "light" ? "light" : "dark");
  // Width drives layout. A shorter viewport/keyboard must never shrink text.
  const scale = auto ? (dev.width >= 2200 ? 1.2 : dev.width >= 1440 ? 1.06 : 1) : manualScale;
  const density: Density = auto ? (dev.width < 600 ? "compact" : dev.width >= 1440 ? "comfortable" : "normal") : manualDensity;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("genai:theme", theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = `${scale * 100}%`;
    root.dataset.density = density;
  }, [scale, density]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.deviceKind = dev.kind;
    root.dataset.devicePlatform = dev.platform;
    root.dataset.orientation = dev.orientation;
    root.dataset.input = dev.coarsePointer ? "touch" : "pointer";
    document.body.classList.toggle("is-touch-device", dev.touch);
    document.body.classList.toggle("is-apple-device", ["iphone", "ipad", "macos"].includes(dev.platform));
  }, [dev.kind, dev.orientation, dev.platform, dev.coarsePointer, dev.touch]);

  useEffect(() => {
    localStorage.setItem(SCALE_KEY, String(manualScale));
    localStorage.setItem(DENSITY_KEY, manualDensity);
    localStorage.setItem(AUTO_KEY, auto ? "1" : "0");
  }, [manualScale, manualDensity, auto]);

  const changeScale = (value: number) => {
    setAuto(false);
    setManualScale(Math.min(1.4, Math.max(0.75, Math.round(value * 100) / 100)));
    setManualDensity(density);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button aria-label="Ajustar vista" className="view-adjust-trigger glass-strong fixed z-40 grid h-11 w-11 place-items-center rounded-full ring-1 ring-border/40 shadow-lg">
          <Settings2 className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" collisionPadding={12} className="view-adjust-panel w-80 rounded-2xl p-4" aria-label="Ajuste de vista">
        <h2 className="mb-2 font-sans text-base font-semibold">Ajuste de vista</h2>
        <p className="mb-3 text-sm text-muted-foreground">Adaptar menús al espacio disponible.</p>
        <label className="mb-3 flex min-h-11 items-center justify-between gap-3 rounded-xl bg-foreground/5 px-3 py-2 text-sm">
          <span>Ajuste automático</span>
          <input type="checkbox" className="h-5 w-5 accent-primary" checked={auto} onChange={(e) => { setManualScale(scale); setManualDensity(density); setAuto(e.target.checked); }} />
        </label>
        <label htmlFor="ui-scale" className="mb-1 flex justify-between text-sm"><span>Tamaño del texto</span><span>{Math.round(scale * 100)}%</span></label>
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <button aria-label="Reducir texto" onClick={() => changeScale(scale - 0.05)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-foreground/5"><Minus className="h-4 w-4" /></button>
          <input id="ui-scale" type="range" min={0.75} max={1.4} step={0.01} value={scale} onChange={(e) => changeScale(Number(e.target.value))} className="min-w-0 flex-1 accent-primary" />
          <button aria-label="Aumentar texto" onClick={() => changeScale(scale + 0.05)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-foreground/5"><Plus className="h-4 w-4" /></button>
        </div>
        <div className="mb-3">
          <p className="mb-1 text-sm text-muted-foreground">Espaciado</p>
          <div className="flex flex-wrap gap-1.5">
            {(["compact", "normal", "comfortable"] as Density[]).map((d) => <button key={d} aria-pressed={density === d} onClick={() => { setAuto(false); setManualScale(scale); setManualDensity(d); }} className={cn("min-h-11 flex-1 rounded-lg px-2 py-2 text-sm", density === d ? "bg-primary text-primary-foreground" : "bg-foreground/5")}>{densityLabels[d]}</button>)}
          </div>
        </div>
        <div className="mb-3 flex gap-2">
          <button aria-pressed={theme === "light"} onClick={() => setTheme("light")} className={cn("flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm", theme === "light" ? "bg-primary text-primary-foreground" : "bg-foreground/5")}><Sun className="h-4 w-4" /> Claro</button>
          <button aria-pressed={theme === "dark"} onClick={() => setTheme("dark")} className={cn("flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm", theme === "dark" ? "bg-primary text-primary-foreground" : "bg-foreground/5")}><Moon className="h-4 w-4" /> Oscuro</button>
        </div>
        <button onClick={() => setAuto(true)} className="mb-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-foreground/5 py-2 text-sm"><RotateCcw className="h-4 w-4" /> Restablecer automático</button>
        <button onClick={() => window.dispatchEvent(new CustomEvent("genaia:clear-cache"))} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 py-2 text-sm text-amber-700 dark:text-amber-100"><Trash2 className="h-4 w-4" /> Limpiar caché y recargar</button>
      </PopoverContent>
    </Popover>
  );
}
