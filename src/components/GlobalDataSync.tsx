import { personWriteEvent, personWriteKey } from "@/lib/personChanges";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

const TABLES = [
  "arboles", "personas", "relaciones", "eventos", "documentos", "fotos",
  "dna_estimates", "familias", "research_tasks", "hipotesis",
  "generated_inferences", "sugerencias",
];

export default function GlobalDataSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;
    let disposed = false;
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
      if (disposed || !pending || document.visibilityState === "hidden" || !navigator.onLine) return;
      if (isEditing()) {
        syncTimer = window.setTimeout(flush, 1000);
        return;
      }
      const table = !refreshAll && dirtyTables.size === 1 ? [...dirtyTables][0] : undefined;
      window.dispatchEvent(new CustomEvent("genaia:data-changed", { detail: { table, source: remoteChange ? "remote" : "resume" } }));
      void queryClient.invalidateQueries({ refetchType: "active" });
      pending = false;
      remoteChange = false;
      refreshAll = false;
      dirtyTables.clear();
    };
    const notifyChange = (source: "remote" | "resume", table?: string) => {
      if (disposed) return;
      pending = true;
      remoteChange ||= source === "remote";
      if (table && table !== "profiles" && table !== "arboles") dirtyTables.add(table);
      else refreshAll = true;
      // Keep the first deadline: a busy stream must not postpone refresh forever.
      if (syncTimer === null) syncTimer = window.setTimeout(flush, 1000);
    };
    const onLocalWrite = (event: Event) => {
      if ((event as CustomEvent).detail === user.id) notifyChange("remote", "personas");
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === personWriteKey(user.id)) notifyChange("remote", "personas");
    };
    window.addEventListener(personWriteEvent, onLocalWrite);
    window.addEventListener("storage", onStorage);
    const channel = supabase.channel(`global-sync-${user.id}`);
    TABLES.forEach((table) => {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table, filter: `user_id=eq.${user.id}` },
        () => {
          if (disposed) return;
          notifyChange("remote", table);
        },
      );
    });
    channel.subscribe((status) => {
      if (disposed) return;
      if (status === "SUBSCRIBED") {
        if (subscribed) notifyChange("resume");
        subscribed = true;
      }
    });
    const profileChannel = supabase.channel(`profile-sync-${user.id}`);
    profileChannel.on("postgres_changes" as any, { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, () => {
      if (disposed) return;
      notifyChange("remote", "profiles");
    });
    profileChannel.subscribe();
    const resume = () => {
      if (!disposed && document.visibilityState !== "hidden" && navigator.onLine) notifyChange("resume");
    };
    const onVisible = () => {
      if (pending && syncTimer === null && document.visibilityState === "visible") flush();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) resume();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", resume);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      disposed = true;
      if (syncTimer !== null) window.clearTimeout(syncTimer);
      window.removeEventListener(personWriteEvent, onLocalWrite);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", resume);
      window.removeEventListener("pageshow", onPageShow);
      supabase.removeChannel(channel);
      supabase.removeChannel(profileChannel);
    };
  }, [user?.id, queryClient]);
  return null;
}
