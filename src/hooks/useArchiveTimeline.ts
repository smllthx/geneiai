import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeReload } from "./use-realtime-reload";
import { supabase } from "@/integrations/supabase/client";
import { collectPages } from "@/lib/collectPages";
import { buildTimeline, type TimelineItem } from "@/lib/timeline";

export function useArchiveTimeline() {
  const { user } = useAuth();
  const revision = useRealtimeReload(["personas", "eventos", "lugares"], user?.id);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (!user) { setItems([]); setLoading(false); return; }
    setError(false);
    Promise.all([
      collectPages((from, to) => supabase.from("personas").select("id,nombres,apellidos,foto_url,nac_fecha,nac_fecha_aprox,nac_rango_ini,nac_rango_fin,nac_lugar_id,bautismo_fecha,bautismo_lugar_id,matrimonio_fecha,matrimonio_lugar_id,defuncion_fecha,defuncion_lugar_id,entierro_fecha,entierro_lugar_id").order("id").range(from, to)),
      collectPages((from, to) => supabase.from("eventos").select("*").order("id").range(from, to)),
      collectPages((from, to) => supabase.from("lugares").select("id,ciudad,provincia,region,pais,parroquia").order("id").range(from, to)),
    ]).then(([people, events, places]) => { if (active) setItems(buildTimeline(people, events, places)); })
      .catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id, revision, attempt]);
  return { items, loading, error, retry: () => setAttempt(n => n + 1) };
}
