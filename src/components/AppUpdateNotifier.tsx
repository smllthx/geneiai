import { useEffect } from "react";
import { toast } from "sonner";
import { applyAppUpdate } from "@/lib/pwa";

export default function AppUpdateNotifier() {
  useEffect(() => {
    const onReady = () => {
      toast("Hay una versión nueva de GENAIA", {
        description: "Toca actualizar para ver los cambios sin cambiar el link.",
        duration: Infinity,
        action: {
          label: "Actualizar",
          onClick: applyAppUpdate,
        },
      });
    };
    window.addEventListener("genaia:update-ready", onReady);
    return () => window.removeEventListener("genaia:update-ready", onReady);
  }, []);

  return null;
}
