import { useEffect } from "react";
import { toast } from "sonner";
import { applyAppUpdate, clearAppCache } from "@/lib/pwa";

export default function AppUpdateNotifier() {
  useEffect(() => {
    const onReady = () => {
      toast("Hay una versión nueva de GENEAI", {
        description: "Toca actualizar para ver los cambios sin cambiar el link.",
        duration: Infinity,
        action: {
          label: "Actualizar",
          onClick: applyAppUpdate,
        },
      });
    };
    window.addEventListener("genaia:update-ready", onReady);
    const onClearCache = async () => {
      const ok = await clearAppCache();
      toast(ok ? "Caché limpiada" : "No se pudo limpiar toda la caché", {
        description: ok ? "Recargando para traer la versión más reciente." : "Puedes cerrar y abrir la app si sigues viendo datos antiguos.",
        duration: 3500,
      });
      if (ok) setTimeout(() => window.location.reload(), 450);
    };
    window.addEventListener("genaia:clear-cache", onClearCache);
    return () => {
      window.removeEventListener("genaia:update-ready", onReady);
      window.removeEventListener("genaia:clear-cache", onClearCache);
    };
  }, []);

  return null;
}
