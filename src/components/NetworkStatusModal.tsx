import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export default function NetworkStatusModal() {
  const { isOffline, retry } = useNetworkStatus();
  if (!isOffline) return null;

  return (
    <div role="status" className="glass-strong fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] z-[70] mx-auto flex max-w-lg items-center gap-3 rounded-2xl px-4 py-2 shadow-md md:bottom-5">
      <WifiOff className="h-5 w-5 shrink-0" />
      <p className="flex-1 text-sm">Sin conexión. Comprueba que se guarden tus cambios al volver.</p>
      <Button size="sm" variant="ghost" onClick={() => void retry()}><RefreshCw className="h-4 w-4" /> Reintentar</Button>
    </div>
  );
}
