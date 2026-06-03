import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { guardarEtnicidadArbol } from "@/lib/etnicidadArbol";
import { useAuth } from "@/contexts/AuthContext";

const RELEVANT_TABLES = new Set(["personas", "relaciones", "lugares"]);

export default function OriginBackgroundSync() {
  const { user } = useAuth();
  const running = useRef(false);
  const lastRun = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const run = async (reason: string) => {
      if (running.current) return;
      if (Date.now() - lastRun.current < 20_000) return;
      running.current = true;
      lastRun.current = Date.now();
      try {
        const { data: prof } = await supabase.from("profiles").select("proband_id").eq("id", user.id).maybeSingle();
        let probandId = (prof as any)?.proband_id as string | null;
        if (!probandId) {
          const { data: ps } = await supabase.from("personas").select("id,nac_fecha").order("nac_fecha", { ascending: false }).limit(1);
          probandId = ps?.[0]?.id ?? null;
        }
        if (!probandId) return;
        const res = await guardarEtnicidadArbol(probandId);
        window.dispatchEvent(new CustomEvent("genaia:origin-updated", { detail: res }));
        await supabase.from("actividad").insert({
          user_id: user.id,
          tipo: "origen_ancestral_actualizado",
          descripcion: "ADN y origen documental recalculados en segundo plano",
          ref_tipo: "persona",
          ref_id: probandId,
          metadata: { estado: "completado", reason, cobertura: res.cobertura, insertados: res.insertados },
        });
      } catch {
        // El cálculo de origen es auxiliar: no debe bloquear la app ni molestar mientras se edita.
      } finally {
        running.current = false;
      }
    };

    const schedule = (reason: string) => {
      if (document.body.dataset.geneiaiEditing === "1") return;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => run(reason), 3500);
    };

    schedule("inicio");
    const onChanged = (event: Event) => {
      const table = (event as CustomEvent)?.detail?.table;
      if (!table || RELEVANT_TABLES.has(table)) schedule(table ?? "cambio");
    };
    window.addEventListener("genaia:data-changed", onChanged);
    const interval = window.setInterval(() => schedule("revision_periodica"), 5 * 60_000);

    return () => {
      window.removeEventListener("genaia:data-changed", onChanged);
      window.clearInterval(interval);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [user?.id]);

  return null;
}
