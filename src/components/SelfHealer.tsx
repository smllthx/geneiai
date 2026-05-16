import { Component, ReactNode, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Bug, Loader2, RefreshCw, Sparkles, X, Power } from "lucide-react";
import { applyHeal, type HealAction } from "@/lib/self-heal";

type CapturedError = {
  message: string;
  stack?: string;
  url?: string;
  source: "auto" | "manual" | "boundary";
};

type Diagnosis = {
  id?: string;
  diagnosis: string;
  severity: "low" | "medium" | "high";
  suggested_action: HealAction;
  user_message: string;
  requires_restart: boolean;
};

let pushError: ((e: CapturedError) => void) | null = null;

export function reportError(message: string, opts?: { stack?: string; source?: "manual" | "auto" }) {
  pushError?.({ message, stack: opts?.stack, url: window.location.href, source: opts?.source ?? "manual" });
}

// ---------- Error Boundary ----------
export class AppErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) {
    pushError?.({ message: err.message, stack: err.stack, url: window.location.href, source: "boundary" });
  }
  render() {
    if (this.state.err) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="glass max-w-md rounded-2xl p-6 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-400" />
            <h2 className="mb-1 font-display text-lg font-semibold">Algo se rompió</h2>
            <p className="mb-4 text-sm text-muted-foreground">{this.state.err.message}</p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => applyHeal("clear-cache")}>
                <RefreshCw className="mr-1 h-4 w-4" /> Auto-reparar y reiniciar
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------- Listener + Panel ----------
export default function SelfHealer() {
  const [errors, setErrors] = useState<CapturedError[]>([]);
  const [current, setCurrent] = useState<CapturedError | null>(null);
  const [diag, setDiag] = useState<Diagnosis | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState("");

  useEffect(() => {
    pushError = (e) => {
      setErrors((arr) => [...arr.slice(-9), e]);
      setCurrent(e);
      setOpen(true);
    };

    const onErr = (ev: ErrorEvent) => {
      if (!ev?.message) return;
      pushError?.({ message: ev.message, stack: ev.error?.stack, url: window.location.href, source: "auto" });
    };
    const onRej = (ev: PromiseRejectionEvent) => {
      const r = ev.reason;
      const msg = typeof r === "string" ? r : r?.message ?? "Promesa rechazada";
      pushError?.({ message: msg, stack: r?.stack, url: window.location.href, source: "auto" });
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      pushError = null;
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);

  const diagnose = useCallback(async (err: CapturedError) => {
    setLoading(true);
    setDiag(null);
    try {
      const { data: ud } = await supabase.auth.getUser();
      const uid = ud?.user?.id;

      const { data, error } = await supabase.functions.invoke("diagnose-error", {
        body: {
          message: err.message,
          stack: err.stack,
          url: err.url,
          user_agent: navigator.userAgent,
          contexto: { route: window.location.pathname },
        },
      });
      if (error) throw error;
      const d = data as Diagnosis;
      setDiag(d);

      if (uid) {
        const { data: ins } = await supabase.from("error_reports").insert({
          user_id: uid,
          message: err.message,
          stack: err.stack ?? null,
          url: err.url ?? null,
          user_agent: navigator.userAgent,
          contexto: { route: window.location.pathname },
          diagnosis: d.diagnosis,
          severity: d.severity,
          suggested_action: d.suggested_action,
          user_message: d.user_message,
          source: err.source === "manual" ? "manual" : "auto",
        }).select("id").single();
        if (ins?.id) setDiag({ ...d, id: ins.id });
      }
    } catch (e: any) {
      setDiag({
        diagnosis: "No se pudo contactar a la IA: " + (e?.message ?? "error"),
        severity: "medium",
        suggested_action: "reload",
        user_message: "Vamos a reiniciar la app para intentar resolverlo.",
        requires_restart: true,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const apply = async () => {
    if (!diag) return;
    if (diag.id) {
      try { await supabase.from("error_reports").update({ applied: true }).eq("id", diag.id); } catch {}
    }
    applyHeal(diag.suggested_action);
  };

  const sendManual = async () => {
    const text = manualText.trim();
    if (!text) return;
    setManualOpen(false);
    setManualText("");
    const err: CapturedError = { message: text, url: window.location.href, source: "manual" };
    setCurrent(err);
    setOpen(true);
    diagnose(err);
  };

  return (
    <>
      {/* FAB reportar */}
      <button
        type="button"
        aria-label="Reportar problema"
        onClick={() => setManualOpen(true)}
        className="glass fixed right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-border/40 shadow-lg transition-transform hover:scale-105"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 13.75rem)" }}
      >
        <Bug className="h-4 w-4 text-amber-400" />
      </button>

      {/* Panel reportar manual */}
      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/60 backdrop-blur-sm md:items-center">
          <div className="glass m-4 w-full max-w-md rounded-2xl p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold">Reportar un problema</h3>
              <button onClick={() => setManualOpen(false)} className="rounded-full p-1 hover:bg-foreground/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              Cuéntale a la IA qué está fallando. Analizará y aplicará un parche.
            </p>
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Ej: no me carga la lista de personas / botón sin reacción…"
              className="mb-3 min-h-[90px] w-full rounded-xl border border-border/40 bg-background/50 p-2 text-sm"
              autoFocus
            />
            <Button onClick={sendManual} className="w-full" disabled={!manualText.trim()}>
              <Sparkles className="mr-1 h-4 w-4" /> Enviar a la IA
            </Button>
          </div>
        </div>
      )}

      {/* Panel diagnóstico */}
      {open && current && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 md:bottom-6">
          <div className="glass w-full max-w-md rounded-2xl p-4 ring-1 ring-border/40 shadow-xl">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <h3 className="font-display text-sm font-semibold">
                  {diag ? "Diagnóstico de la IA" : "Error detectado"}
                </h3>
              </div>
              <button
                onClick={() => { setOpen(false); setDiag(null); }}
                className="rounded-full p-1 hover:bg-foreground/10"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-3 break-words rounded-lg bg-foreground/5 px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
              {current.message}
            </p>

            {!diag && !loading && (
              <Button onClick={() => diagnose(current)} className="w-full">
                <Sparkles className="mr-1 h-4 w-4" /> Pedir diagnóstico a la IA
              </Button>
            )}
            {loading && (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analizando…
              </div>
            )}
            {diag && (
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Qué pasó</p>
                  <p className="text-sm">{diag.user_message}</p>
                </div>
                <div className="rounded-lg bg-foreground/5 p-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Técnico:</span> {diag.diagnosis}
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="rounded-full bg-foreground/8 px-2 py-0.5">
                    Severidad: {diag.severity}
                  </span>
                  <span className="rounded-full bg-foreground/8 px-2 py-0.5">
                    Acción: {diag.suggested_action}
                  </span>
                </div>
                <Button onClick={apply} className="w-full">
                  <Power className="mr-1 h-4 w-4" />
                  {diag.requires_restart ? "Aplicar parche y reiniciar" : "Aplicar parche"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
