import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Suscribe a postgres_changes en las tablas indicadas, filtrando por user_id
 * cuando se provee. Devuelve un contador `reloadKey` que aumenta cada vez que
 * llega un cambio, con un pequeño debounce para evitar tormentas de updates.
 *
 * Ejemplo:
 *   const reloadKey = useRealtimeReload(["personas","relaciones"], userId);
 *   useEffect(() => { load(); }, [reloadKey]);
 */
export function useRealtimeReload(tables: string[], userId?: string | null, debounceMs = 300) {
  const [reloadKey, setReloadKey] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    const bump = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setReloadKey((k) => k + 1), debounceMs);
    };
    const ch = supabase.channel(`rt-${tables.join("-")}-${userId}`);
    tables.forEach((t) => {
      ch.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: t, filter: `user_id=eq.${userId}` },
        bump,
      );
    });
    ch.subscribe();
    window.addEventListener("genaia:data-changed", bump);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      window.removeEventListener("genaia:data-changed", bump);
      supabase.removeChannel(ch);
    };
  }, [tables.join("|"), userId, debounceMs]);

  return reloadKey;
}
