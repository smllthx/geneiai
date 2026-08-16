import { useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Laptop, Loader2, RefreshCw, LogOut, Search, ExternalLink, ShieldCheck, AlertTriangle } from "lucide-react";

const COMPANION = "http://127.0.0.1:8787";

type Status = "checking" | "unreachable" | "closed" | "login_required" | "ready";

type Result = {
  pid: string;
  name: string;
  url: string;
  birth?: string | null;
  death?: string | null;
  details?: string[];
};

async function callTool<T = unknown>(tool: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${COMPANION}/tools/${tool}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

export default function FamilySearchLocalBrowser() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [anio, setAnio] = useState("");
  const [lugar, setLugar] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);

  const refresh = useCallback(async () => {
    setStatus("checking");
    try {
      const health = await fetch(`${COMPANION}/health`, { cache: "no-store" });
      if (!health.ok) throw new Error("health");
      const st = await callTool<{ status?: Status }>("familysearch_browser_status");
      setStatus((st?.status as Status) ?? "closed");
    } catch {
      setStatus("unreachable");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const run = async (tool: string, body?: Record<string, unknown>) => {
    setBusy(tool);
    try {
      const data = await callTool<{ ok?: boolean; status?: string; message?: string; error?: string; results?: Result[] }>(tool, body ?? {});
      if (data?.status === "login_required") {
        setStatus("login_required");
        toast.warning(data.message ?? "Inicia sesión en la ventana de FamilySearch.");
      } else if (data?.ok === false) {
        toast.error(data.error ?? data.message ?? "El compañero local devolvió un error.");
      } else {
        if (data?.message) toast.success(data.message);
        if (tool === "familysearch_browser_search_people") {
          setResults(data.results ?? []);
          if ((data.results ?? []).length === 0) toast.info("Sin resultados visibles.");
        }
      }
      if (tool !== "familysearch_browser_search_people") await refresh();
      return data;
    } catch {
      setStatus("unreachable");
      toast.error("Compañero local no accesible.");
    } finally {
      setBusy(null);
    }
  };

  const badge = {
    checking: { text: "Comprobando…", cls: "text-muted-foreground" },
    unreachable: { text: "Compañero local no accesible", cls: "text-destructive" },
    closed: { text: "Compañero activo · navegador cerrado", cls: "text-foreground" },
    login_required: { text: "Sesión no iniciada", cls: "text-accent" },
    ready: { text: "✓ Sesión activa", cls: "text-primary" },
  }[status];

  return (
    <GlassCard className="mb-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Laptop className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold">Navegador local</h3>
            <span className={`glass-pill text-xs font-semibold ${badge.cls}`}>{badge.text}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulta FamilySearch con tu propia sesión, desde un navegador visible en tu Mac. Tu contraseña nunca se lee
            ni se guarda: el inicio de sesión ocurre solo en esa ventana. Los datos que veas aquí <strong>no se importan
            automáticamente</strong>; siempre pasan por revisión y comparación.
          </p>

          {status === "unreachable" ? (
            <Alert className="mt-3 border-destructive/30 bg-destructive/5">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Compañero local no accesible</AlertTitle>
              <AlertDescription className="space-y-2">
                <p className="text-xs">
                  Arráncalo en tu Mac con <code>npm run familysearch:browser</code> y vuelve a comprobar. Desde la app
                  publicada el navegador puede bloquear <code>127.0.0.1</code>: en ese caso usa su interfaz local.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void refresh()}>
                    <RefreshCw className="h-4 w-4" /> Comprobar de nuevo
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={COMPANION} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" /> Abrir UI local
                    </a>
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" disabled={busy !== null} onClick={() => void run("familysearch_browser_open")}>
                  {busy === "familysearch_browser_open" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  Abrir FamilySearch
                </Button>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void refresh()}>
                  <RefreshCw className="h-4 w-4" /> Estado de sesión
                </Button>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("familysearch_browser_logout")}>
                  <LogOut className="h-4 w-4" /> Cerrar sesión y borrar cookies
                </Button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div><Label className="text-xs">Nombre</Label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
                <div><Label className="text-xs">Apellido</Label><Input value={apellido} onChange={(e) => setApellido(e.target.value)} /></div>
                <div><Label className="text-xs">Año aprox.</Label><Input value={anio} inputMode="numeric" onChange={(e) => setAnio(e.target.value)} /></div>
                <div><Label className="text-xs">Lugar</Label><Input value={lugar} onChange={(e) => setLugar(e.target.value)} /></div>
              </div>
              <Button
                className="mt-3"
                size="sm"
                disabled={busy !== null || (!nombre && !apellido)}
                onClick={() =>
                  void run("familysearch_browser_search_people", {
                    nombre: nombre || undefined,
                    apellido: apellido || undefined,
                    anio: anio ? Number(anio) : undefined,
                    lugar: lugar || undefined,
                    limit: 20,
                  })
                }
              >
                {busy === "familysearch_browser_search_people" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Búsqueda de prueba
              </Button>

              {results && results.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" /> Solo lectura. Nada se agrega al árbol sin tu revisión.
                  </p>
                  {results.map((r) => (
                    <div key={r.pid} className="rounded-2xl bg-foreground/5 p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="gen-name">{r.name}</strong>
                        <span className="glass-pill text-xs">{r.pid}</span>
                        <a className="text-xs text-primary underline" href={r.url} target="_blank" rel="noreferrer">Ver en FamilySearch</a>
                      </div>
                      {(r.birth || r.death) && (
                        <p className="mt-1 text-xs text-muted-foreground">{[r.birth, r.death].filter(Boolean).join(" · ")}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
