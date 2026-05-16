import { useEffect, useState } from "react";
import { useDevice } from "@/hooks/use-device";
import { Settings2, X, Minus, Plus, Smartphone, Tablet, Monitor, RotateCcw, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

const SCALE_KEY = "genai:ui-scale";
const DENSITY_KEY = "genai:ui-density";
const AUTO_KEY = "genai:ui-auto";

type Density = "compact" | "normal" | "comfortable";

/**
 * Auto-adjusts root font-size and density based on device/viewport.
 * Exposes a small floating panel to fine-tune scale + density.
 * Persisted in localStorage.
 */
export default function AdaptiveViewport() {
  const dev = useDevice();
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState<boolean>(() => localStorage.getItem(AUTO_KEY) !== "0");
  const [scale, setScale] = useState<number>(() => Number(localStorage.getItem(SCALE_KEY)) || 1);
  const [density, setDensity] = useState<Density>(
    () => (localStorage.getItem(DENSITY_KEY) as Density) || "normal"
  );
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("genai:theme") as "light" | "dark") || "dark"
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("genai:theme", theme);
  }, [theme]);

  // Auto-scale based on device kind + diagonal
  useEffect(() => {
    if (!auto) return;
    let s = 1;
    let d: Density = "normal";
    switch (dev.kind) {
      case "phone":    s = 0.92; d = "compact"; break;
      case "phablet":  s = 0.96; d = "compact"; break;
      case "tablet":   s = 1.00; d = "normal"; break;
      case "laptop":   s = 1.00; d = "normal"; break;
      case "desktop":  s = 1.06; d = "comfortable"; break;
      case "tv":       s = 1.20; d = "comfortable"; break;
    }
    // very small heights → squeeze a bit
    if (dev.height < 700) s -= 0.04;
    setScale(Number(s.toFixed(2)));
    setDensity(d);
  }, [auto, dev.kind, dev.height]);

  // Apply to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = `${Math.round(16 * scale)}px`;
    root.dataset.density = density;
    root.dataset.deviceKind = dev.kind;
    root.dataset.orientation = dev.orientation;
    localStorage.setItem(SCALE_KEY, String(scale));
    localStorage.setItem(DENSITY_KEY, density);
    localStorage.setItem(AUTO_KEY, auto ? "1" : "0");
  }, [scale, density, auto, dev.kind, dev.orientation]);

  const reset = () => { setAuto(true); };
  const Icon = dev.kind === "phone" || dev.kind === "phablet" ? Smartphone
    : dev.kind === "tablet" ? Tablet : Monitor;

  return (
    <>
      <button
        aria-label="Ajustar vista"
        onClick={() => setOpen((o) => !o)}
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 9.5rem)" }}
        className="glass-strong fixed right-4 z-40 grid h-11 w-11 place-items-center rounded-full ring-1 ring-border/40 shadow-lg md:!bottom-4 md:right-4"
      >
        <Settings2 className="h-5 w-5" />
      </button>

      {open && (
        <div
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 14.5rem)" }}
          className="glass-strong fixed right-3 z-40 w-72 rounded-2xl p-4 ring-1 ring-border/40 shadow-xl md:!bottom-20 md:right-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Ajuste de vista</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-foreground/60 hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mb-3 text-[11px] text-muted-foreground">
            {dev.kind} · {dev.width}×{dev.height}px · {dev.dpr.toFixed(2)}x · ~{dev.diagonalIn.toFixed(1)}″ · {dev.orientation}
          </p>

          <label className="mb-3 flex items-center justify-between rounded-xl bg-foreground/5 px-3 py-2 text-sm">
            <span>Auto-ajustar</span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
            />
          </label>

          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Escala</span>
              <span className="tabular-nums">{Math.round(scale * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setAuto(false); setScale((s) => Math.max(0.75, Number((s - 0.05).toFixed(2)))); }}
                className="grid h-8 w-8 place-items-center rounded-lg bg-foreground/5 hover:bg-foreground/10"
              ><Minus className="h-3.5 w-3.5" /></button>
              <input
                type="range" min={0.75} max={1.4} step={0.01} value={scale}
                onChange={(e) => { setAuto(false); setScale(Number(e.target.value)); }}
                className="flex-1 accent-primary"
              />
              <button
                onClick={() => { setAuto(false); setScale((s) => Math.min(1.4, Number((s + 0.05).toFixed(2)))); }}
                className="grid h-8 w-8 place-items-center rounded-lg bg-foreground/5 hover:bg-foreground/10"
              ><Plus className="h-3.5 w-3.5" /></button>
            </div>
          </div>

          <div className="mb-3">
            <p className="mb-1 text-xs text-muted-foreground">Densidad</p>
            <div className="flex gap-1.5">
              {(["compact","normal","comfortable"] as Density[]).map((d) => (
                <button
                  key={d}
                  onClick={() => { setAuto(false); setDensity(d); }}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1.5 text-xs capitalize transition-colors",
                    density === d ? "bg-primary text-primary-foreground" : "bg-foreground/5 hover:bg-foreground/10"
                  )}
                >{d}</button>
              ))}
            </div>
          </div>

          <button
            onClick={reset}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-foreground/5 py-2 text-xs hover:bg-foreground/10"
          >
            <RotateCcw className="h-3 w-3" /> Restablecer auto
          </button>
        </div>
      )}
    </>
  );
}
