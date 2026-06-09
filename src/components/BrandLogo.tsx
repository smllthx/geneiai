import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { Moon, Sun } from "lucide-react";

/**
 * GENEAI brand logo — interactivo: click alterna tema oscuro/claro.
 * Halo en gradiente (ámbar → esmeralda → índigo) que se ve bien en ambos modos.
 */
export default function BrandLogo({
  className,
  size = 44,
  interactive = true,
  showHalo = true,
}: {
  className?: string;
  size?: number;
  interactive?: boolean;
  showHalo?: boolean;
}) {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light",
  );

  // Sincroniza si otro componente cambia el tema
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try { localStorage.setItem("genai:theme", next); } catch {}
    window.dispatchEvent(new CustomEvent("genai:theme-change", { detail: next }));
    setTheme(next);
  };

  const halo = showHalo
    ? "p-[2px] bg-[conic-gradient(from_140deg,#f5b14a_0deg,#10b981_140deg,#6366f1_260deg,#f5b14a_360deg)] shadow-[0_0_24px_-4px_rgba(245,177,74,0.45),0_0_36px_-6px_rgba(99,102,241,0.35)]"
    : "";

  const inner = (
    <span
      className={cn(
        "relative inline-flex items-center justify-center rounded-full transition-transform duration-300",
        halo,
      )}
      style={{ width: size, height: size }}
    >
      <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-background/70 backdrop-blur-sm">
        <img
          src={logo}
          alt="GENEAI"
          width={size - 6}
          height={size - 6}
          className="object-contain transition-transform duration-300 group-hover:scale-105"
          draggable={false}
        />
        {interactive && (
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background/90 text-foreground shadow ring-1 ring-border/50 opacity-0 transition-opacity group-hover:opacity-100"
          >
            {theme === "dark" ? <Sun className="h-2.5 w-2.5" /> : <Moon className="h-2.5 w-2.5" />}
          </span>
        )}
      </span>
    </span>
  );

  if (!interactive) {
    return <span className={cn("group inline-flex shrink-0", className)}>{inner}</span>;
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
      className={cn(
        "group inline-flex shrink-0 cursor-pointer rounded-full outline-none transition-transform hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/50",
        className,
      )}
    >
      {inner}
    </button>
  );
}
