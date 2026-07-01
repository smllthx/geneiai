import { useEffect, useMemo, useState } from "react";
import { Maximize2, Minus, PanelRightOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";

type AppWindowRequest = {
  id?: string;
  title?: string;
  path?: string;
};

type AppWindow = {
  id: string;
  title: string;
  path: string;
  minimized: boolean;
  z: number;
};

const withWindowParam = (path: string) => {
  if (!path) return "/inicio?window=1";
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}window=1`;
};

export default function AppWindowLayer() {
  const [windows, setWindows] = useState<AppWindow[]>([]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<AppWindowRequest>).detail ?? {};
      const path = detail.path || "/inicio";
      const id = detail.id || path;
      const title = detail.title || "Ventana";
      const z = Date.now();

      setWindows((current) => {
        const exists = current.some((item) => item.id === id);
        if (exists) {
          return current.map((item) =>
            item.id === id ? { ...item, title, path, minimized: false, z } : item,
          );
        }
        return [...current, { id, title, path, minimized: false, z }];
      });
    };

    window.addEventListener("geneai:open-window", onOpen);
    return () => window.removeEventListener("geneai:open-window", onOpen);
  }, []);

  const openWindows = useMemo(() => windows.filter((item) => !item.minimized), [windows]);
  const dockedWindows = useMemo(() => windows.filter((item) => item.minimized), [windows]);

  if (!windows.length) return null;

  const minimize = (id: string) => {
    setWindows((current) => current.map((item) => (item.id === id ? { ...item, minimized: true } : item)));
  };
  const restore = (id: string) => {
    setWindows((current) =>
      current.map((item) => (item.id === id ? { ...item, minimized: false, z: Date.now() } : item)),
    );
  };
  const close = (id: string) => {
    setWindows((current) => current.filter((item) => item.id !== id));
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]">
      {openWindows.map((item, index) => (
        <section
          key={item.id}
          className={cn(
            "pointer-events-auto fixed overflow-hidden rounded-[28px] border border-white/20 bg-background/82 shadow-2xl backdrop-blur-2xl",
            "left-3 right-3 md:left-auto md:right-5",
          )}
          style={{
            top: `calc(env(safe-area-inset-top, 0px) + ${88 + index * 24}px)`,
            width: "min(92vw, 500px)",
            height: "min(74vh, 680px)",
            zIndex: item.z,
          }}
          aria-label={`Ventana ${item.title}`}
        >
          <header className="flex h-12 items-center gap-2 border-b border-border/60 bg-card/80 px-3">
            <PanelRightOpen className="h-4 w-4 text-primary" />
            <strong className="min-w-0 flex-1 truncate text-sm">{item.title}</strong>
            <a
              href={item.path}
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-foreground/8 hover:text-foreground"
              title="Abrir pantalla completa"
              aria-label={`Abrir ${item.title} en pantalla completa`}
            >
              <Maximize2 className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => minimize(item.id)}
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-foreground/8 hover:text-foreground"
              title="Dejar al lado"
              aria-label={`Minimizar ${item.title}`}
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => close(item.id)}
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-destructive/12 hover:text-destructive"
              title="Cerrar ventana"
              aria-label={`Cerrar ${item.title}`}
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <iframe
            src={withWindowParam(item.path)}
            title={item.title}
            className="h-[calc(100%-3rem)] w-full border-0 bg-background"
          />
        </section>
      ))}

      {dockedWindows.length > 0 && (
        <aside
          className="pointer-events-auto fixed right-3 top-24 flex max-w-[42vw] flex-col gap-2 md:right-4"
          aria-label="Ventanas guardadas al lado"
        >
          {dockedWindows.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-2xl border border-white/20 bg-card/85 p-2 shadow-lg backdrop-blur-xl"
            >
              <button
                type="button"
                onClick={() => restore(item.id)}
                className="min-w-0 flex-1 truncate rounded-xl px-3 py-2 text-left text-xs font-semibold transition hover:bg-foreground/8"
                title={`Restaurar ${item.title}`}
              >
                {item.title}
              </button>
              <button
                type="button"
                onClick={() => close(item.id)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-destructive/12 hover:text-destructive"
                aria-label={`Eliminar ventana ${item.title}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </aside>
      )}
    </div>
  );
}
