import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export default function NetworkStatusModal() {
  const { isOffline, isChecking, retry, lastCheckedAt } = useNetworkStatus();
  const [dismissedOnline, setDismissedOnline] = useState(false);

  useEffect(() => {
    if (isOffline) setDismissedOnline(false);
  }, [isOffline]);

  if (!isOffline && dismissedOnline) return null;
  if (!isOffline && !isChecking) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] z-[70] mx-auto max-w-xl md:bottom-5"
      role="status"
      aria-live="polite"
    >
      <div className="glass-strong rounded-3xl border border-border/70 p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${isOffline ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>
            {isOffline ? <WifiOff className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{isOffline ? "Estás sin conexión" : "Comprobando conexión"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isOffline
                ? "Puedes revisar datos recientes guardados en caché. Las acciones que necesiten internet se sincronizarán cuando vuelva la conexión."
                : "GENEAI está verificando que el servidor responda antes de refrescar datos."}
            </p>
            {lastCheckedAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Última comprobación: {lastCheckedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Button size="sm" onClick={() => void retry()} disabled={isChecking}>
              <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} /> Reintentar
            </Button>
            {!isOffline && (
              <Button size="sm" variant="ghost" onClick={() => setDismissedOnline(true)}>
                Ocultar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
