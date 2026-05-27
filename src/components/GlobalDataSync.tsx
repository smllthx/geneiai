import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const TABLES = [
  "personas",
  "relaciones",
  "eventos",
  "documentos",
  "fotos",
  "familias",
  "research_tasks",
  "hipotesis",
  "generated_inferences",
  "sugerencias",
];

export default function GlobalDataSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const broadcast = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("genaia-sync") : null;
    let lastNotice = 0;

    const notifyChange = (source: "remote" | "tab", table?: string) => {
      window.dispatchEvent(new CustomEvent("genaia:data-changed", { detail: { table, source } }));
      if (source === "remote" && Date.now() - lastNotice > 4000) {
        lastNotice = Date.now();
        toast.info("Datos sincronizados", { description: "La app actualizó la información abierta en otra sesión.", duration: 1800 });
      }
    };

    broadcast?.addEventListener("message", (event) => {
      if (event.data?.type === "data-changed") notifyChange("tab", event.data.table);
    });

    const channel = supabase.channel(`global-sync-${user.id}`);
    TABLES.forEach((table) => {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table, filter: `user_id=eq.${user.id}` },
        () => {
          broadcast?.postMessage({ type: "data-changed", table });
          notifyChange("remote", table);
        },
      );
    });
    channel.subscribe();

    return () => {
      broadcast?.close();
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return null;
}
