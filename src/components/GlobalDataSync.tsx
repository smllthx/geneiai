import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

const TABLES = [
  "arboles",
  "personas",
  "relaciones",
  "eventos",
  "documentos",
  "fotos",
  "dna_estimates",
  "familias",
  "research_tasks",
  "hipotesis",
  "generated_inferences",
  "sugerencias",
];

export default function GlobalDataSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const broadcast = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(`genaia-sync-${user.id}`) : null;
    let lastNotice = 0;
    let syncTimer: number | null = null;
    const isEditing = () =>
      document.body.dataset.geneiaiEditing === "1" ||
      Boolean(document.querySelector("[data-geneiai-editing='true']"));

    let pending = false;
    let remoteChange = false;
    let refreshAll = false;
    let subscribed = false;
    const dirtyTables = new Set<string>();
    const flush = () => {
      syncTimer = null;
      if (!pending || document.visibilityState === "hidden" || !navigator.onLine) return;
      if (isEditing()) {
        syncTimer = window.setTimeout(flush, 1000);
        return;
      }
      const table = !refreshAll && dirtyTables.size === 1 ? [...dirtyTables][0] : undefined;
      window.dispatchEvent(new CustomEvent("genaia:data-changed", { detail: { table, source: remoteChange ? "remote" : "resume" } }));
      void queryClient.invalidateQueries({ refetchType: "active" });
      // Realtime signals a change; it does not confirm a successful data fetch.
      if (remoteChange && Date.now() - lastNotice > 6000) {
        lastNotice = Date.now();
        toast.info("Cambios en otra sesión", { description: "Consultando la información actualizada…", duration: 1600 });
      }
      pending = false;
      remoteChange = false;
      refreshAll = false;
      dirtyTables.clear();
    };
    const notifyChange = (source: "remote" | "tab" | "resume", table?: string) => {
      pending = true;
      remoteChange ||= source === "remote";
      if (table && table !== 'profiles' && table !== 'arboles') dirtyTables.add(table);
      else refreshAll = true;
      if (syncTimer) window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(flush, 1000);
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
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        if (subscribed) notifyChange("resume");
        subscribed = true;
      }
    });
    // Keep profile events isolated: an unavailable publication must not break data events.
    const profileChannel = supabase.channel(`profile-sync-${user.id}`);
    profileChannel.on('postgres_changes' as any, { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, () => {
        broadcast?.postMessage({ type: 'data-changed', table: 'profiles' });
        notifyChange('remote', 'profiles');
      });
    profileChannel.subscribe();
    const resume = () => {
      if (document.visibilityState !== "hidden" && navigator.onLine) notifyChange("resume");
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    window.addEventListener("pageshow", resume);
    // Foreground fallback also covers missed events and temporarily unavailable Realtime.
    const refreshTimer = window.setInterval(resume, 60_000);

    return () => {
      if (syncTimer) window.clearTimeout(syncTimer);
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("pageshow", resume);
      broadcast?.close();
      supabase.removeChannel(channel);
      supabase.removeChannel(profileChannel);
    };
  }, [user?.id, queryClient]);

  return null;
}
