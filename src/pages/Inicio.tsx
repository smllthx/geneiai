import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardView, { type DashboardStats } from "@/components/home/DashboardView";
import { getRecent } from "@/lib/recent";
import { applyTreeScope, fetchAllPeople, fetchAllRelations, getActiveTreeId } from "@/lib/peopleData";
const MigrationMap = lazy(() => import("@/components/MigrationMap"));
const FamilyTimeline = lazy(() => import("@/components/FamilyTimeline"));
const loadingSection = <p role="status" className="home-empty">Cargando…</p>;

export default function Inicio() {
  const [stats, setStats] = useState<DashboardStats>({
    totalApellidos: 0, personas: 0, lugares: 0, fotos: 0,
    docsPendientes: 0, coincidencias: 0, hipotesis: 0, inferencias: 0, apellidos: [] as string[],
  });
  const [actividad, setActividad] = useState<any[]>([]);
  const [recientes, setRecientes] = useState<any[]>([]);
  const [vistasRecientes, setVistasRecientes] = useState<any[]>([]);
  const [sinPadres, setSinPadres] = useState<any[]>([]);
  const [sinFotos, setSinFotos] = useState<any[]>([]);
  const [dataRevision, setDataRevision] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const refresh = () => setDataRevision((value) => value + 1);
    window.addEventListener("genaia:data-changed", refresh);
    return () => window.removeEventListener("genaia:data-changed", refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const treeId = await getActiveTreeId();
      const allPersonas = await fetchAllPeople<any>("id,nombres,apellidos,foto_url,updated_at", { treeId });
      const personIds = new Set(allPersonas.map((p) => p.id));
      const [l, f, d, c, h, i, a, allRels, fotos] = await Promise.all([
        supabase.from("lugares").select("id", { count: "exact", head: true }),
        applyTreeScope(supabase.from("fotos").select("id,personas_ids", { count: "exact" }) as any, treeId),
        applyTreeScope(supabase.from("documentos").select("id,personas_mencionadas", { count: "exact" }).eq("estado", "pendiente") as any, treeId),
        supabase.from("coincidencias").select("id,ref_a,ref_b,estado").eq("estado", "pendiente"),
        supabase.from("hipotesis").select("id,personas,estado").eq("estado", "abierta"),
        supabase.from("generated_inferences").select("id,person_id,status").eq("status", "pending"),
        supabase.from("actividad").select("*").order("created_at", { ascending: false }).limit(6),
        fetchAllRelations<any>("persona_id,tipo", { treeId }),
        applyTreeScope(supabase.from("fotos").select("personas_ids") as any, treeId),
      ]);
      if (cancelled) return;
      const failed = [l, f, d, c, h, i, a, fotos].find((result) => result.error);
      if (failed) throw failed.error;
      setLoadError(false);
      const ap = new Map<string, number>();
      allPersonas.forEach((row) => {
        const x = row.apellidos?.split(/\s+/)[0]; if (!x) return;
        ap.set(x, (ap.get(x) ?? 0) + 1);
      });
      const activeCoincidencias = (c.data ?? []).filter((row: any) => personIds.has(row.ref_a) || personIds.has(row.ref_b));
      const activeHipotesis = (h.data ?? []).filter((row: any) => (row.personas ?? []).some((id: string) => personIds.has(id)));
      const activeInferencias = (i.data ?? []).filter((row: any) => personIds.has(row.person_id));
      setStats({
        totalApellidos: ap.size, personas: allPersonas.length, lugares: l.count ?? 0, fotos: f.count ?? 0,
        docsPendientes: d.count ?? 0, coincidencias: activeCoincidencias.length,
        hipotesis: activeHipotesis.length, inferencias: activeInferencias.length,
        apellidos: [...ap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([x]) => x),
      });
      const recentByUpdated = [...allPersonas].sort((x, y) => String(y.updated_at ?? "").localeCompare(String(x.updated_at ?? ""))).slice(0, 8);
      setRecientes(recentByUpdated); setActividad(a.data ?? []);

      // Personas sin padres
      const conPadres = new Set(
        (allRels ?? [])
          .filter((rl: any) => rl.tipo === "padre" || rl.tipo === "madre")
          .map((rl: any) => rl.persona_id)
      );
      setSinPadres(allPersonas.filter((per: any) => !conPadres.has(per.id)).slice(0, 6));

      // Personas sin fotos
      const conFotos = new Set<string>();
      (fotos.data ?? []).forEach((fr: any) => (fr.personas_ids ?? []).forEach((id: string) => conFotos.add(id)));
      setSinFotos(allPersonas.filter((per: any) => !per.foto_url && !conFotos.has(per.id)).slice(0, 6));

      // Vistas recientes (localStorage)
      const recentEntries = getRecent();
      const recentIds = recentEntries.map((r) => r.id);
      if (recentIds.length) {
        const map = new Map(allPersonas.map((x: any) => [x.id, x]));
        setVistasRecientes(recentIds.map((rid) => map.get(rid)).filter(Boolean).slice(0, 8));
        const editedIds = recentEntries.filter((r) => r.action === "edited").map((r) => r.id);
        if (editedIds.length) {
          const edited = editedIds.map((rid) => map.get(rid)).filter(Boolean).slice(0, 8);
          if (edited.length) setRecientes(edited);
        }
      }
    })().catch(() => {
      if (!cancelled) setLoadError(true);
    }).finally(() => { if (!cancelled) setLoading(false); });

    const onChange = () => {
      const recentIds = getRecent().map((r) => r.id);
      setVistasRecientes((prev) => {
        const byId = new Map(prev.map((x: any) => [x.id, x]));
        return recentIds.map((rid) => byId.get(rid)).filter(Boolean);
      });
    };
    window.addEventListener("genaia:recent-changed", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("genaia:recent-changed", onChange);
    };
  }, [dataRevision]);

  return <DashboardView
    stats={stats} recientes={recientes} vistasRecientes={vistasRecientes}
    sinPadres={sinPadres} sinFotos={sinFotos} actividad={actividad}
    loading={loading} loadError={loadError} onRetry={() => setDataRevision(value => value + 1)}
    map={<Suspense fallback={loadingSection}><MigrationMap height={280} /></Suspense>}
    timeline={<Suspense fallback={loadingSection}><FamilyTimeline /></Suspense>}
  />;
}
