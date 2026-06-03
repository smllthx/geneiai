import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
// SectionHeader removed — replaced by minimal sticky header
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PersonCard, EmptySlot, type PersonaLite } from "@/components/PersonCard";
import QuickAddRelative from "@/components/QuickAddRelative";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Crosshair, Pencil, ZoomIn, ZoomOut, Undo2, GitBranch, LayoutGrid, Sparkles, Maximize2, Minimize2, FileDown, Trash2, X, ShieldCheck, Rocket, Loader2, CheckCircle2, AlertCircle, SlidersHorizontal, ListChecks, Clock3, MoreHorizontal, Columns2 } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import TreeInsights from "@/components/TreeInsights";
import { toast } from "sonner";
import FanChart from "@/components/FanChart";
import DynastyView from "@/components/DynastyView";
import { padresDe as kPadresDe, conyugesDe as kConyugesDe, hijosDe as kHijosDe, hermanosDe as kHermanosDe, relacionesEntre, type RelTipo } from "@/lib/kinship";
import { checkCoherence } from "@/lib/coherence";
import { notify } from "@/lib/notifications";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeReload } from "@/hooks/use-realtime-reload";
import { getRecent } from "@/lib/recent";


type Vista = "ascendientes" | "lineas" | "abanico" | "dinastica";
type Categoria = "predeterminada" | "pais" | "fuentes" | "historia";
type Panel = "arbol" | "tareas" | "recientes" | "mas";

const generationName = (level: number) => {
  if (level <= 1) return "padres";
  if (level === 2) return "abuelos";
  if (level === 3) return "bisabuelos";
  if (level === 4) return "tatarabuelos";
  if (level === 5) return "trastatarabuelos";
  return `${level}.ª generación`;
};

const generationOptionLabel = (generations: number) => {
  if (generations === 999) return "Todas las generaciones";
  const lastLevel = Math.max(1, generations - 1);
  return `${generations} gen · hasta ${generationName(lastLevel)}`;
};

export default function Arbol() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const centroParam = searchParams.get("centro");
  const [personas, setPersonas] = useState<PersonaLite[]>([]);
  const [rels, setRels] = useState<any[]>([]);
  const [center, setCenter] = useState<string>("");
  const [probandLocked, setProbandLocked] = useState(false);
  const [generaciones, setGeneraciones] = useState(7);
  const [zoom, setZoom] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [vista, setVista] = useState<Vista>(() => {
    try { return (localStorage.getItem("genaia:default-tree-view") as Vista) || "ascendientes"; } catch { return "ascendientes"; }
  });
  const [dropTarget, setDropTarget] = useState<{ source: string; target: string } | null>(null);
  const [lastUndo, setLastUndo] = useState<{ ids: string[]; label: string } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [categoria, setCategoria] = useState<Categoria>("predeterminada");
  const [docsByPersona, setDocsByPersona] = useState<Map<string, number>>(new Map());
  const [loadingTree, setLoadingTree] = useState(true);
  const [panel, setPanel] = useState<Panel>("arbol");
  const [tasks, setTasks] = useState<any[]>([]);
  const [recentPeople, setRecentPeople] = useState<PersonaLite[]>([]);
  const [agentProgress, setAgentProgress] = useState<{ total: number; done: number; ok: number; running: boolean; errors: string[] }>({ total: 0, done: 0, ok: 0, running: false, errors: [] });
  const initialTreeLoaded = useRef(false);

  const { user: authUser } = useAuth();
  const rtKey = useRealtimeReload(["personas", "relaciones", "eventos"], authUser?.id ?? null);
  useEffect(() => { if (rtKey > 0) setReloadKey((k) => k + 1); }, [rtKey]);


  useEffect(() => {
    (async () => {
      if (!initialTreeLoaded.current) setLoadingTree(true);
      const user = (await supabase.auth.getUser()).data.user;
      const [{ data: p }, { data: r }, profRes, { data: docs }] = await Promise.all([
        supabase.from("personas").select("id,nombres,apellidos,sexo,nac_fecha,nac_rango_ini,defuncion_fecha,viva,nacionalidad,foto_url").order("apellidos").limit(10000),
        supabase.from("relaciones").select("id,persona_id,pariente_id,tipo,notas").limit(20000),
        user ? supabase.from("profiles").select("proband_id").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null } as any),
        supabase.from("documentos").select("personas_mencionadas").limit(5000),
      ]);
      setPersonas((p as any) ?? []);
      setRels(r ?? []);
      const counts = new Map<string, number>();
      for (const d of docs ?? []) {
        for (const pid of (d as any).personas_mencionadas ?? []) counts.set(pid, (counts.get(pid) ?? 0) + 1);
      }
      setDocsByPersona(counts);
      const recentIds = getRecent().map((x) => x.id);
      const peopleById = new Map(((p as any) ?? []).map((person: PersonaLite) => [person.id, person]));
      setRecentPeople(recentIds.map((id) => peopleById.get(id)).filter(Boolean) as PersonaLite[]);
      const probandId = (profRes as any)?.data?.proband_id;
      const validCentro = centroParam && p?.some((x: any) => x.id === centroParam);
      const validProband = probandId && p?.some((x: any) => x.id === probandId);
      if (validCentro) {
        setCenter(centroParam!);
        setProbandLocked(false); // permite explorar otra rama (tío, primo, etc.)
      } else if (validProband) {
        setCenter(probandId);
        setProbandLocked(true);
      } else if (!center && p?.length) {
        setCenter(p[0].id);
      }
      initialTreeLoaded.current = true;
      setLoadingTree(false);
    })();
  }, [reloadKey, centroParam]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("research_tasks")
        .select("id,descripcion,estado,tipo,person_id,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      setTasks(data ?? []);
    })();
  }, [reloadKey]);

  // Hide bottom nav / Siri / sidebar when tree is fullscreen
  useEffect(() => {
    if (fullscreen) {
      document.body.classList.add("tree-fullscreen");
      document.body.style.overflow = "hidden";
    } else {
      document.body.classList.remove("tree-fullscreen");
      document.body.style.overflow = "";
    }
    return () => {
      document.body.classList.remove("tree-fullscreen");
      document.body.style.overflow = "";
    };
  }, [fullscreen]);

  const eliminarTodoElArbol = async () => {
    if (!confirm("Esto eliminará TODAS las personas, relaciones y eventos de tu árbol. ¿Continuar?")) return;
    if (!confirm("Confirma una vez más: se borrará TODO el árbol genealógico. Esta acción no se puede deshacer.")) return;
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return toast.error("Sesión no encontrada");
    const t = toast.loading("Eliminando árbol completo…");
    try {
      await supabase.from("relaciones").delete().eq("user_id", user.id);
      await supabase.from("eventos").delete().eq("user_id", user.id);
      await supabase.from("personas").delete().eq("user_id", user.id);
      toast.dismiss(t);
      toast.success("Árbol eliminado por completo");
      setCenter("");
      reload();
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e.message ?? "Error al eliminar");
    }
  };

  const byId = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas]);

  // Use unified kinship helpers — same logic everywhere in the app
  const padresDe = (pid: string) => kPadresDe(pid, rels as any, byId);
  const conyugesDe = (pid: string) => kConyugesDe(pid, rels as any, byId);
  const hijosDe = (pid: string) => kHijosDe(pid, rels as any, byId);
  const hermanosDe = (pid: string) => kHermanosDe(pid, rels as any, byId);

  const reload = () => setReloadKey((k) => k + 1);

  const crearRelacion = async (sourceId: string, targetId: string, tipo: RelTipo) => {
    if (sourceId === targetId) return toast.error("No puedes relacionar a una persona consigo misma.");
    const user = (await supabase.auth.getUser()).data.user!;
    const source = byId.get(sourceId);
    let pairs: { persona_id: string; pariente_id: string; tipo: RelTipo }[] = [];
    if (tipo === "padre" || tipo === "madre") {
      // source es el "hijo", target es padre/madre
      const t: RelTipo = tipo;
      pairs = [
        { persona_id: sourceId, pariente_id: targetId, tipo: t },
        { persona_id: targetId, pariente_id: sourceId, tipo: "hijo" },
      ];
    } else if (tipo === "hijo") {
      const tipoPadre: RelTipo = source?.sexo === "femenino" ? "madre" : "padre";
      pairs = [
        { persona_id: targetId, pariente_id: sourceId, tipo: tipoPadre },
        { persona_id: sourceId, pariente_id: targetId, tipo: "hijo" },
      ];
    } else if (tipo === "conyuge") {
      pairs = [
        { persona_id: sourceId, pariente_id: targetId, tipo: "conyuge" },
        { persona_id: targetId, pariente_id: sourceId, tipo: "conyuge" },
      ];
    } else if (tipo === "hermano") {
      pairs = [
        { persona_id: sourceId, pariente_id: targetId, tipo: "hermano" },
        { persona_id: targetId, pariente_id: sourceId, tipo: "hermano" },
      ];
    }
    if (tipo === "padre") await supabase.from("personas").update({ sexo: "masculino" }).eq("id", targetId).is("sexo", null);
    if (tipo === "madre") await supabase.from("personas").update({ sexo: "femenino" }).eq("id", targetId).is("sexo", null);
    const rows = pairs.map((p) => ({ ...p, user_id: user.id, naturaleza: "biologica" as const, certeza: "probable" as const }));
    const { data, error } = await supabase.from("relaciones").upsert(rows, { onConflict: "user_id,persona_id,pariente_id,tipo", ignoreDuplicates: true }).select("id");
    if (error) return toast.error(error.message);
    const ids = (data ?? []).map((d: any) => d.id);
    const sNm = byId.get(sourceId);
    const tNm = byId.get(targetId);
    setLastUndo({ ids, label: `${sNm?.nombres} ↔ ${tNm?.nombres} (${tipo})` });
    toast.success("Relación creada", {
      action: { label: "Deshacer", onClick: async () => {
        await supabase.from("relaciones").delete().in("id", ids);
        setLastUndo(null);
        reload();
      }},
      duration: 5000,
    });
    setDropTarget(null);
    window.dispatchEvent(new CustomEvent("genaia:data-changed", { detail: { personId: sourceId } }));
    reload();
  };

  const persona = center ? byId.get(center) : undefined;

  // Relation editor (delete or change type)
  const [editRel, setEditRel] = useState<{ a: PersonaLite; b: PersonaLite } | null>(null);

  const eliminarRelacionEntre = async (aId: string, bId: string) => {
    const ids = relacionesEntre(aId, bId, rels as any).map((r) => r.id);
    if (!ids.length) return;
    await supabase.from("relaciones").delete().in("id", ids);
    toast.success("Relación eliminada");
    setEditRel(null);
    reload();
  };

  // Wrapper: in edit mode = drag/drop + delete badge; otherwise person cards open
  // the full genealogical profile. The center is changed from the header control.
  const TreeCard = ({ p, focusable = true, children }: { p: PersonaLite; focusable?: boolean; children: React.ReactNode }) => {
    if (editMode) {
      const linkedToCenter = persona && p.id !== persona.id && relacionesEntre(persona.id, p.id, rels as any).length > 0;
      return (
        <div
          draggable
          onDragStart={(e) => { e.dataTransfer.setData("text/persona", p.id); e.dataTransfer.effectAllowed = "link"; }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "link"; }}
          onDrop={(e) => {
            e.preventDefault();
            const src = e.dataTransfer.getData("text/persona");
            if (!src || src === p.id) return;
            setDropTarget({ source: src, target: p.id });
          }}
          className="relative ring-2 ring-accent/40 rounded-3xl cursor-grab active:cursor-grabbing"
        >
          {children}
          {linkedToCenter && (
            <button
              onClick={(e) => { e.stopPropagation(); setEditRel({ a: persona!, b: p }); }}
              className="absolute -top-2 -right-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-md hover:scale-110 transition"
              aria-label="Editar relación"
              title="Editar / eliminar esta relación"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      );
    }
    return <>{children}</>;
  };

  // Determine highlight ring based on selected categoria
  const catRing = (p: PersonaLite | undefined): string => {
    if (!p || categoria === "predeterminada") return "";
    if (categoria === "fuentes") {
      const n = docsByPersona.get(p.id) ?? 0;
      return n > 0 ? "ring-2 ring-emerald-400/70 rounded-2xl" : "opacity-60";
    }
    if (categoria === "pais") {
      const nac = ((p as any).nacionalidad ?? "").toLowerCase();
      if (!nac) return "opacity-60";
      // Stable hue from string
      let h = 0; for (const c of nac) h = (h * 31 + c.charCodeAt(0)) % 360;
      return `rounded-2xl ring-2`;
    }
    if (categoria === "historia") {
      const y = (p as any).nac_fecha ? new Date((p as any).nac_fecha).getUTCFullYear() : (p as any).nac_rango_ini;
      if (!y) return "opacity-60";
      if (y < 1850) return "ring-2 ring-amber-500/70 rounded-2xl";
      if (y < 1920) return "ring-2 ring-orange-500/70 rounded-2xl";
      if (y < 1970) return "ring-2 ring-purple-500/70 rounded-2xl";
      return "ring-2 ring-sky-500/70 rounded-2xl";
    }
    return "";
  };
  const catStyle = (p: PersonaLite | undefined): React.CSSProperties => {
    if (!p || categoria !== "pais") return {};
    const nac = ((p as any).nacionalidad ?? "").toLowerCase();
    if (!nac) return {};
    let h = 0; for (const c of nac) h = (h * 31 + c.charCodeAt(0)) % 360;
    return { boxShadow: `0 0 0 2px hsl(${h} 70% 55%)`, borderRadius: "1rem" };
  };
  const Hl = ({ p, children }: { p?: PersonaLite; children: React.ReactNode }) => (
    <div className={catRing(p)} style={catStyle(p)}>{children}</div>
  );

  const Draggable = TreeCard; // backwards-compat alias used by older sections below

  const PartnershipStrip = ({ p, compact = false }: { p: PersonaLite; compact?: boolean }) => {
    const partners = conyugesDe(p.id);
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
          <Draggable p={p}>
            <Hl p={p}>
              <PersonCard p={p} highlighted={!compact} compact={compact} onClick={() => navigate(`/personas/${p.id}`)} />
            </Hl>
          </Draggable>
          {partners.map((partner) => (
            <Draggable key={partner.id} p={partner}>
              <Hl p={partner}>
                <PersonCard p={partner} compact={compact} />
              </Hl>
            </Draggable>
          ))}
          <QuickAddRelative personaId={p.id} defaultTipo="conyuge" onAdded={reload}
            trigger={<button className="block"><EmptySlot label="cónyuge / unión" onClick={() => {}} /></button>} />
        </div>
        {partners.length > 0 && (
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {partners.length} unión{partners.length === 1 ? "" : "es"} registrada{partners.length === 1 ? "" : "s"}
          </div>
        )}
      </div>
    );
  };

  const PersonTile = ({ p, highlighted = false }: { p: PersonaLite; highlighted?: boolean }) => (
    <Draggable p={p}>
      <Hl p={p}>
        <PersonCard p={p} compact highlighted={highlighted} onClick={() => navigate(`/personas/${p.id}`)} />
      </Hl>
    </Draggable>
  );

  const AddTile = ({ personaId, tipo, label }: { personaId: string; tipo: "padre" | "madre" | "conyuge" | "hijo"; label: string }) => (
    <QuickAddRelative personaId={personaId} personaSexo={byId.get(personaId)?.sexo} defaultTipo={tipo} onAdded={reload}
      trigger={<button className="block"><EmptySlot label={label} onClick={() => {}} /></button>} />
  );

  const CouplePair = ({ childId, padre, madre }: { childId: string; padre?: PersonaLite; madre?: PersonaLite }) => (
    <div className="relative inline-flex items-stretch justify-center gap-1 rounded-2xl border border-border/50 bg-card/20 p-1.5">
      <div className="pointer-events-none absolute left-[50%] top-1/2 h-px w-[calc(100%-2.5rem)] -translate-x-1/2 bg-foreground/30" />
      <div className="relative z-10">
        {padre ? <PersonTile p={padre} /> : <AddTile personaId={childId} tipo="padre" label="padre" />}
      </div>
      <div className="relative z-10">
        {madre ? <PersonTile p={madre} /> : <AddTile personaId={childId} tipo="madre" label="madre" />}
      </div>
    </div>
  );

  // Recursive ascendants renderer — compact, connected, and symmetric.
  const Ascendants = ({ pid, gen, trail = [] }: { pid: string; gen: number; trail?: string[] }) => {
    if (gen <= 0 || trail.includes(pid)) return null;
    const { padre, madre } = padresDe(pid);
    const hasAny = !!(padre || madre);
    const nextTrail = [...trail, pid];
    return (
      <div className="inline-flex flex-col items-center">
        {hasAny && (
          <div className="relative mb-2 inline-grid grid-cols-2 items-end justify-center gap-3 sm:gap-4">
            <div className="flex min-w-[156px] flex-col items-center justify-end">
              {padre ? <Ascendants pid={padre.id} gen={gen - 1} trail={nextTrail} /> : null}
            </div>
            <div className="flex min-w-[156px] flex-col items-center justify-end">
              {madre ? <Ascendants pid={madre.id} gen={gen - 1} trail={nextTrail} /> : null}
            </div>
            <div className="pointer-events-none absolute bottom-0 left-1/4 right-1/4 h-px bg-foreground/25" />
            <div className="pointer-events-none absolute bottom-0 left-1/2 h-4 w-px translate-y-full bg-foreground/25" />
          </div>
        )}
        <div className="relative mt-4">
          <CouplePair childId={pid} padre={padre} madre={madre} />
        </div>
        {hasAny && <div className="h-4 w-px bg-foreground/30" />}
      </div>
    );
  };

  const DescendantTree = ({ pid, depth = 2 }: { pid: string; depth?: number }) => {
    if (depth <= 0) return null;
    const children = hijosDe(pid);
    if (!children.length) return null;
    return (
        <div className="flex flex-col items-center gap-3">
          <div className="h-4 w-px bg-foreground/30" />
        <div className="relative flex items-start justify-center gap-4">
          {children.length > 1 && <div className="pointer-events-none absolute left-[12%] right-[12%] top-0 h-px bg-foreground/25" />}
          {children.map((child) => (
            <div key={child.id} className="relative flex flex-col items-center gap-2">
              <div className="h-3 w-px bg-foreground/25" />
              <PartnershipStrip p={child} compact />
              <DescendantTree pid={child.id} depth={depth - 1} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const SiblingBranch = ({ p }: { p: PersonaLite }) => (
    <div className="flex min-w-[220px] flex-col items-center gap-2 rounded-2xl border border-border/45 bg-card/20 p-3">
      <PartnershipStrip p={p} compact />
      {hijosDe(p.id).length > 0 && (
        <>
          <div className="h-3 w-px bg-foreground/25" />
          <div className="flex max-w-[360px] flex-wrap justify-center gap-2">
            {hijosDe(p.id).map((child) => <PersonTile key={child.id} p={child} />)}
          </div>
        </>
      )}
    </div>
  );

  const LineageColumn = ({ label, tone, root, missingTipo }: { label: string; tone: string; root?: PersonaLite; missingTipo: "padre" | "madre" }) => (
    <div className="flex min-w-[320px] flex-1 flex-col items-center rounded-2xl border border-border bg-card/55 p-4">
      <div className={`mb-4 rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
        {label}
      </div>
      {root ? (
        <>
          <Ascendants pid={root.id} gen={Math.max(0, generaciones - 1)} />
          <div className="h-4 w-px bg-foreground/30" />
          <Draggable p={root}><Hl p={root}><PersonCard p={root} compact /></Hl></Draggable>
        </>
      ) : (
        <QuickAddRelative personaId={persona!.id} defaultTipo={missingTipo} onAdded={reload}
          trigger={<button className="block"><EmptySlot label={missingTipo} onClick={() => {}} /></button>} />
      )}
    </div>
  );

  const exportarGedcom = async () => {
    const { data, error } = await supabase.functions.invoke("familysearch-export", { body: { format: "gedcom" } });
    if (error || !data) {
      // Fallback: ir a la página Importar/Exportar
      toast.info("Abriendo el centro de Importar / Exportar para crear el archivo");
      window.location.href = "/importar";
      return;
    }
    const blob = new Blob([typeof data === "string" ? data : (data as any).gedcom ?? JSON.stringify(data)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "arbol.ged"; a.click(); URL.revokeObjectURL(url);
    toast.success("Archivo GEDCOM descargado");
  };

  const verificarCoherencia = async () => {
    const t = toast.loading("Verificando coherencia del árbol…");
    try {
      const issues = checkCoherence(personas as any, rels as any);
      toast.dismiss(t);
      if (issues.length === 0) { toast.success("Árbol coherente: 0 problemas detectados"); return; }
      const errors = issues.filter((i) => i.severity === "error").length;
      const warns = issues.filter((i) => i.severity === "warn").length;
      toast.success(`${issues.length} problema(s) — ${errors} crítico(s), ${warns} aviso(s)`);
      const user = (await supabase.auth.getUser()).data.user;
      if (user) {
        // Persist as research_tasks so they appear in Tareas + Notificaciones
        const rows = issues.slice(0, 50).map((i) => ({
          user_id: user.id,
          person_id: i.persona_id,
          tipo: "otro" as const,
          descripcion: `[${i.severity.toUpperCase()}] ${i.message} (${i.rule})`,
        }));
        await supabase.from("research_tasks").insert(rows);
        notify("Verificación de coherencia", { body: `${issues.length} problemas registrados como tareas`, url: "/arbol" });
      }
    } catch (e: any) { toast.dismiss(t); toast.error(e.message ?? "Error"); }
  };

  const agentesEnParalelo = async () => {
    if (!persona) return;
    const pid = persona.id;
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return toast.error("Sesión no encontrada");
    const issues = checkCoherence(personas as any, rels as any).filter((i) => i.persona_id === pid || i.related_id === pid);
    const agentJobs = [
      { titulo: "Resumen local", descripcion: `Revisar datos vitales de ${persona.nombres} ${persona.apellidos}` },
      { titulo: "Ascendientes faltantes", descripcion: `Padres/abuelos faltantes detectados: ${padresDe(pid).all.length < 2 ? "sí" : "sin faltantes inmediatos"}` },
      { titulo: "Descendientes y cónyuges", descripcion: `${hijosDe(pid).length} hijo(s) y ${conyugesDe(pid).length} cónyuge(s) o coprogenitor(es) registrados` },
      { titulo: "Coherencia", descripcion: `${issues.length} aviso(s) locales para revisar` },
    ];
    setAgentProgress({ total: agentJobs.length, done: 0, ok: 0, running: true, errors: [] });
    const t = toast.loading("Desplegando agentes en paralelo…");
    try {
      await supabase.from("research_tasks").insert(agentJobs.map((job) => ({
        user_id: user.id,
        person_id: pid,
        tipo: "otro" as const,
        descripcion: `Agente local: ${job.titulo} — ${job.descripcion}`,
      })));
      const results = await Promise.allSettled(agentJobs.map(async () => {
        setAgentProgress((p) => ({ ...p, done: Math.min(p.total, p.done + 1), ok: p.ok + 1 }));
        return true;
      }));
      toast.dismiss(t);
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const errors = results.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => r.reason?.message ?? "Error desconocido");
      setAgentProgress({ total: agentJobs.length, done: agentJobs.length, ok, running: false, errors });
      toast.success(`${ok}/4 agentes completados para ${persona.nombres}`);
      notify("Agentes en paralelo", { body: `${ok}/4 completados para ${persona.nombres} ${persona.apellidos}`, url: `/personas/${pid}` });
      reload();
    } catch (e: any) {
      toast.dismiss(t); toast.error(e.message ?? "Error");
      setAgentProgress((p) => ({ ...p, running: false, errors: [...p.errors, e.message ?? "Error"] }));
    }
  };

  const completarTarea = async (id: string) => {
    const { error } = await supabase.from("research_tasks").update({ estado: "completada" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Tarea marcada como completada");
    setTasks((cur) => cur.map((t) => t.id === id ? { ...t, estado: "completada" } : t));
  };


  return (
    <div
      className={fullscreen ? "fixed inset-0 z-[100] bg-background overflow-y-auto" : "-mx-3 md:-mx-6"}
      style={fullscreen ? {
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      } : undefined}
    >
      {/* Minimal top bar */}
      <div
        className="sticky top-0 z-20 mb-2 flex items-center justify-between gap-2 bg-background/80 px-3 py-2 backdrop-blur-md md:px-6"
        style={fullscreen ? { paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" } : undefined}
      >
        <h1 className="min-w-0 flex-1 font-display text-2xl font-bold leading-tight tracking-tight md:text-3xl">Árbol</h1>
        <div className="glass inline-flex rounded-full p-1">
          {([
            ["ascendientes", GitBranch, "Retrato"],
            ["lineas", Columns2, "Ramas"],
            ["abanico", Sparkles, "Abanico"],
            ["dinastica", LayoutGrid, "Linaje"],
          ] as [Vista, any, string][]).map(([k, Icon, label]) => (
            <button
              key={k}
              onClick={() => setVista(k)}
              aria-label={label}
              title={label}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-all ${
                vista === k ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-foreground/5"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setFullscreen((v) => !v)}
          aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          className="glass grid h-9 w-9 place-items-center rounded-full text-foreground/70 transition hover:bg-foreground/5 hover:text-foreground"
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Compact tree control row */}
      <div className="mb-3 flex items-center gap-2 px-3 md:px-6">
        <div className="min-w-0 flex-1 rounded-full border border-border bg-card/60 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Centro: </span>
          <span className="font-medium">{persona ? `${persona.nombres} ${persona.apellidos}` : "configúralo en Configuración"}</span>
          <Link to="/configuracion" className="ml-2 text-link underline">Cambiar</Link>
        </div>
        <Select value={String(generaciones)} onValueChange={(v) => setGeneraciones(parseInt(v))}>
          <SelectTrigger className="h-9 w-[186px] rounded-full text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50].map((n) => (
              <SelectItem key={n} value={String(n)}>{generationOptionLabel(n)}</SelectItem>
            ))}
            <SelectItem value="999">Todas las generaciones</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {vista === "ascendientes" && (
        <div className="mb-3 flex items-center gap-2 overflow-x-auto px-3 pb-1 md:px-6 [&::-webkit-scrollbar]:hidden">
          {["Padres", "Abuelos", "Bisabuelos", "Tatarabuelos", "Trastatarabuelos"].map((label) => (
            <span
              key={label}
              className="shrink-0 rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] font-medium text-muted-foreground"
            >
              {label}
            </span>
          ))}
          <span className="shrink-0 text-[11px] text-muted-foreground">
            La vista retrato mantiene madres, padres, cónyuges y uniones visibles cuando existen.
          </span>
        </div>
      )}

      {/* Configuración del árbol: resaltado por categoría */}
      <div className="mb-3 flex items-center gap-2 overflow-x-auto px-3 pb-1 md:px-6 [&::-webkit-scrollbar]:hidden">
        {([
          ["predeterminada", "Predeterminada"],
          ["pais", "País"],
          ["fuentes", "Fuentes"],
          ["historia", "Historia"],
        ] as [Categoria, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setCategoria(k)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
              categoria === k ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-foreground/5"
            }`}
          >{label}</button>
        ))}
        {categoria !== "predeterminada" && (
          <span className="ml-1 text-[10px] text-muted-foreground">
            {categoria === "fuentes" && "Resalta personas con documentos vinculados."}
            {categoria === "pais" && "Color por nacionalidad."}
            {categoria === "historia" && "Color por época de nacimiento."}
          </span>
        )}
      </div>


      {agentProgress.total > 0 && (
        <div className="mx-3 mb-3 rounded-2xl border border-border bg-card/70 p-3 shadow-sm md:mx-6">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2 font-medium">
              {agentProgress.running ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : agentProgress.errors.length ? <AlertCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-primary" />}
              Agentes
            </span>
            <span className="text-xs text-muted-foreground">{agentProgress.done}/{agentProgress.total} · {agentProgress.ok} ok</span>
          </div>
          <Progress value={(agentProgress.done / agentProgress.total) * 100} className="h-1.5" />
        </div>
      )}

      {editMode && (
        <p className="mx-3 mb-2 rounded-xl bg-accent/10 border border-accent/30 px-3 py-2 text-xs text-foreground md:mx-6">
          Arrastra una persona <strong>sobre otra</strong> para crear una relación.
        </p>
      )}

      {persona && <TreeInsights personaId={persona.id} personaNombre={`${persona.nombres} ${persona.apellidos}`} />}

      {/* Floating tools panel — agrupa todo lo demás */}
      <Sheet>
        <SheetTrigger asChild>
          <button
            aria-label="Herramientas del árbol"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.25rem)" }}
            className="fixed right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_12px_40px_-8px_hsl(var(--primary)/0.55)] ring-1 ring-border/40 transition-transform hover:scale-105 active:scale-95 md:!bottom-6"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[88vw] max-w-sm overflow-y-auto p-0">
          <SheetHeader className="border-b border-border/60 p-4">
            <SheetTitle className="font-display text-lg">Herramientas</SheetTitle>
          </SheetHeader>
          <div className="space-y-5 p-4">
            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Vista</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} aria-label="Alejar"><ZoomOut className="h-4 w-4" /></Button>
                <div className="flex-1 text-center text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</div>
                <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))} aria-label="Acercar"><ZoomIn className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" onClick={() => setZoom(1)} aria-label="Centrar"><Crosshair className="h-4 w-4" /></Button>
              </div>
              <Button variant={fullscreen ? "default" : "outline"} size="sm" className="mt-2 w-full justify-start" onClick={() => setFullscreen((v) => !v)}>
                {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                {fullscreen ? "Salir pantalla completa" : "Pantalla completa"}
              </Button>
            </section>

            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Edición</p>
              <Button variant={editMode ? "default" : "outline"} size="sm" className="w-full justify-start" onClick={() => setEditMode((v) => !v)}>
                <Pencil className="h-4 w-4" /> {editMode ? "Editando relaciones" : "Editar relaciones"}
              </Button>
              {lastUndo && (
                <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={async () => {
                  await supabase.from("relaciones").delete().in("id", lastUndo.ids);
                  setLastUndo(null); reload();
                }}><Undo2 className="h-4 w-4" /> Deshacer última</Button>
              )}
            </section>

            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Inteligencia</p>
              <div className="space-y-2">
                <Button variant="secondary" size="sm" className="w-full justify-start" onClick={agentesEnParalelo} disabled={!persona}>
                  {agentProgress.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Agentes en paralelo
                </Button>
                <Button variant="secondary" size="sm" className="w-full justify-start" onClick={verificarCoherencia}>
                  <ShieldCheck className="h-4 w-4" /> Verificar coherencia
                </Button>
              </div>
            </section>

            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Datos</p>
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={exportarGedcom}>
                <FileDown className="h-4 w-4" /> Exportar GEDCOM
              </Button>
            </section>

            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-destructive/80">Peligro</p>
              <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={eliminarTodoElArbol}>
                <Trash2 className="h-4 w-4" /> Eliminar todo el árbol
              </Button>
            </section>
          </div>
        </SheetContent>
      </Sheet>

      <div className="sticky bottom-3 z-20 mx-auto mb-4 grid max-w-lg grid-cols-4 gap-1 rounded-3xl border border-border bg-card/95 p-1 shadow-lg backdrop-blur md:bottom-4">
        {([
          ["arbol", GitBranch, "Árbol"],
          ["tareas", ListChecks, "Tareas"],
          ["recientes", Clock3, "Recientes"],
          ["mas", MoreHorizontal, "Más"],
        ] as [Panel, any, string][]).map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => setPanel(key)}
            className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition ${
              panel === key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {panel === "tareas" ? (
        <div className="mx-3 grid gap-3 pb-24 md:mx-6 md:grid-cols-2">
          {tasks.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground md:col-span-2">
              No hay tareas pendientes. Puedes generar tareas con Verificar coherencia o Agentes en paralelo.
            </div>
          ) : tasks.map((task) => {
            const p = task.person_id ? byId.get(task.person_id) : null;
            return (
              <div key={task.id} className="rounded-2xl border border-border bg-card/70 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">{task.tipo}</span>
                  <span className="text-[11px] text-muted-foreground">{task.estado}</span>
                </div>
                <p className="text-sm">{task.descripcion}</p>
                {p && <Link to={`/personas/${p.id}`} className="mt-2 block text-xs text-link underline">{p.nombres} {p.apellidos}</Link>}
                {task.estado !== "completada" && (
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => completarTarea(task.id)}>
                    <CheckCircle2 className="h-4 w-4" /> Completar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : panel === "recientes" ? (
        <div className="mx-3 grid gap-3 pb-24 md:mx-6 md:grid-cols-3">
          {recentPeople.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground md:col-span-3">
              Todavía no hay personas vistas recientemente.
            </div>
          ) : recentPeople.map((p) => (
            <Link key={p.id} to={`/personas/${p.id}`} className="block">
              <PersonCard p={p} />
            </Link>
          ))}
        </div>
      ) : panel === "mas" ? (
        <div className="mx-3 grid gap-3 pb-24 md:mx-6 md:grid-cols-2">
          <Button variant="outline" className="justify-start rounded-2xl p-6" onClick={verificarCoherencia}>
            <ShieldCheck className="h-4 w-4" /> Verificar coherencia del árbol
          </Button>
          <Button variant="outline" className="justify-start rounded-2xl p-6" onClick={agentesEnParalelo} disabled={!persona}>
            <Rocket className="h-4 w-4" /> Crear tareas con agentes
          </Button>
          <Button variant="outline" className="justify-start rounded-2xl p-6" onClick={exportarGedcom}>
            <FileDown className="h-4 w-4" /> Exportar GEDCOM
          </Button>
          <Link to="/configuracion" className="rounded-2xl border border-border bg-card/70 p-6 text-sm font-medium hover:bg-foreground/5">
            Configurar persona central, vista por defecto y Face ID / Touch ID
          </Link>
        </div>
      ) : loadingTree ? (
        <div className="grid min-h-[45vh] place-items-center rounded-2xl border border-border bg-card/60">
          <div className="text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />Cargando árbol…</div>
        </div>
      ) : !persona ? (
        <p className="text-muted-foreground">Selecciona una persona o crea la primera en Personas.</p>
      ) : vista === "abanico" ? (
        <div className="overflow-x-auto pb-24 md:pb-8">
          <div className="mx-auto origin-top transition-transform" style={{ transform: `scale(${zoom})`, width: "max-content" }}>
            <div className="mb-3 flex justify-center">
              <PartnershipStrip p={persona} compact />
            </div>
            <FanChart personas={personas} rels={rels} centerId={persona.id} generations={generaciones} size={760} />
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-500" /> línea paterna ·{" "}
            <span className="inline-block h-2 w-2 rounded-full bg-pink-500" /> línea materna
          </p>
        </div>
      ) : vista === "dinastica" ? (
        <div className="overflow-x-auto pb-24 md:pb-8">
          <div className="mx-auto origin-top transition-transform" style={{ transform: `scale(${zoom})`, minWidth: "max-content" }}>
            <div className="mb-4 flex justify-center">
              <PartnershipStrip p={persona} compact />
            </div>
            <DynastyView personas={personas} rels={rels} centerId={persona.id} generations={generaciones} />
          </div>
        </div>
      ) : vista === "lineas" ? (
        <div className="overflow-x-auto pb-24 md:pb-8">
          <div
            className="mx-auto flex flex-col items-center gap-5 origin-top transition-transform"
            style={{ transform: `scale(${zoom})`, minWidth: "max-content" }}
          >
            {(() => {
              const { padre, madre } = padresDe(persona.id);
              return (
                <>
                  <div className="grid min-w-[720px] grid-cols-2 gap-4">
                    <LineageColumn label="Línea paterna" tone="bg-sky-500/15 text-sky-300" root={padre} missingTipo="padre" />
                    <LineageColumn label="Línea materna" tone="bg-rose-500/15 text-rose-300" root={madre} missingTipo="madre" />
                  </div>
                  <div className="flex h-8 items-start justify-center">
                    <div className="h-8 w-px bg-foreground/30" />
                  </div>
                  <PartnershipStrip p={persona} />
                  <p className="max-w-md text-center text-xs text-muted-foreground">
                    Vista conjunta de ramas paterna y materna. Usa Editar relaciones para corregir vínculos o agregar familiares faltantes.
                  </p>
                </>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto pb-24 md:pb-8">
          <div
            className="mx-auto flex flex-col items-center gap-5 origin-top transition-transform"
            style={{ transform: `scale(${zoom})`, minWidth: "max-content" }}
          >
            <div className="rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Ascendencia paterna y materna
            </div>
            <Ascendants pid={persona.id} gen={generaciones} />

            <div className="h-4 w-px bg-foreground/30" />
            <div className="rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Persona central y uniones
            </div>
            <PartnershipStrip p={persona} />

            {hermanosDe(persona.id).length > 0 && (
              <>
                <div className="rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Hermanos, cuñados y sobrinos
                </div>
                <div className="flex max-w-[1100px] flex-wrap items-start justify-center gap-4">
                  {hermanosDe(persona.id).map((sibling) => <SiblingBranch key={sibling.id} p={sibling} />)}
                </div>
              </>
            )}

            <div className="rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Descendencia
            </div>
            {hijosDe(persona.id).length > 0 ? (
              <DescendantTree pid={persona.id} depth={3} />
            ) : (
              <div className="text-xs text-muted-foreground">Sin hijos registrados.</div>
            )}
            <div className="flex justify-center">
              <AddTile personaId={persona.id} tipo="hijo" label="hijo/a" />
            </div>

            <Link to={`/personas/${persona.id}`} className="text-sm text-link underline">
              Ver ficha completa →
            </Link>
          </div>
        </div>
      )}

      {/* Diálogo: elegir tipo de relación tras drop */}
      <Dialog open={!!dropTarget} onOpenChange={(o) => !o && setDropTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Conectar personas</DialogTitle></DialogHeader>
          {dropTarget && (() => {
            const s = byId.get(dropTarget.source);
            const t = byId.get(dropTarget.target);
            return (
              <>
                <p className="text-sm text-muted-foreground">
                  <strong>{s?.nombres} {s?.apellidos}</strong> es… de <strong>{t?.nombres} {t?.apellidos}</strong>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["padre", "Padre"],
                    ["madre", "Madre"],
                    ["hijo", "Hijo/a"],
                    ["conyuge", "Cónyuge"],
                    ["hermano", "Hermano/a"],
                  ] as [RelTipo, string][]).map(([t, label]) => (
                    <Button key={t} variant="outline" onClick={() => crearRelacion(dropTarget.source, dropTarget.target, t)}>
                      {label}
                    </Button>
                  ))}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Editar relación existente */}
      <Dialog open={!!editRel} onOpenChange={(o) => !o && setEditRel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar relación</DialogTitle></DialogHeader>
          {editRel && (
            <>
              <p className="text-sm text-muted-foreground">
                Entre <strong>{editRel.a.nombres} {editRel.a.apellidos}</strong> y{" "}
                <strong>{editRel.b.nombres} {editRel.b.apellidos}</strong>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["padre", "Cambiar a padre/madre"],
                  ["hijo", "Cambiar a hijo/a"],
                  ["conyuge", "Cambiar a cónyuge"],
                  ["hermano", "Cambiar a hermano/a"],
                ] as [RelTipo, string][]).map(([t, label]) => (
                  <Button key={t} variant="outline" size="sm" onClick={async () => {
                    await eliminarRelacionEntre(editRel.a.id, editRel.b.id);
                    await crearRelacion(editRel.b.id, editRel.a.id, t);
                  }}>{label}</Button>
                ))}
              </div>
              <DialogFooter>
                <Button variant="destructive" size="sm" onClick={() => eliminarRelacionEntre(editRel.a.id, editRel.b.id)}>
                  <Trash2 className="h-4 w-4" /> Eliminar relación
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
