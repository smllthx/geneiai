import { useEffect, useRef, useState } from "react";

/**
 * Suscribe a postgres_changes en las tablas indicadas, filtrando por user_id
 * cuando se provee. Devuelve un contador `reloadKey` que aumenta cada vez que
 * llega un cambio, con un pequeño debounce para evitar tormentas de updates.
 *
 * Ejemplo:
 *   const reloadKey = useRealtimeReload(["personas","relaciones"], userId);
 *   useEffect(() => { load(); }, [reloadKey]);
 */
export function useRealtimeReload(tables: string[], userId?: string | null, debounceMs = 150) {
  const [reloadKey, setReloadKey] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    const relevant = new Set(tables);
    const flush = () => {
      if (document.body.dataset.geneiaiEditing === "1" || document.querySelector("[data-geneiai-editing='true']")) {
        timer.current = window.setTimeout(flush, debounceMs);
        return;
      }
      timer.current = null;
      setReloadKey((k) => k + 1);
    };
    const bump = (event?: Event) => {
      const table = (event as CustomEvent)?.detail?.table;
      if (table && !relevant.has(table)) return;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, debounceMs);
    };
    window.addEventListener("genaia:data-changed", bump);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      window.removeEventListener("genaia:data-changed", bump);
    };
  }, [tables.join("|"), userId, debounceMs]);

  return reloadKey;
}
