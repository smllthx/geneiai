import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
// SectionHeader removed — replaced by minimal sticky header
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PersonCard, EmptySlot, type PersonaLite } from "@/components/PersonCard";
import QuickAddRelative from "@/components/QuickAddRelative";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Crosshair, Pencil, ZoomIn, ZoomOut, Undo2, GitBranch, LayoutGrid, Sparkles, Maximize2, Minimize2, FileDown, Trash2, X, ShieldCheck, Rocket, Loader2, CheckCircle2, AlertCircle, SlidersHorizontal, Search } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import TreeInsights from "@/components/TreeInsights";
import { toast } from "sonner";
import FanChart from "@/components/FanChart";
import DynastyView from "@/components/DynastyView";
import { padresDe as kPadresDe, conyugesDe as kConyugesDe, hijosDe as kHijosDe, relacionesEntre, type RelTipo } from "@/lib/kinship";
import { checkCoherence } from "@/lib/coherence";
import { notify } from "@/lib/notifications";

type Vista = "ascendientes" | "abanico" | "dinastica";
type Categoria = "predeterminada" | "pais" | "fuentes" | "historia";

export default function Arbol() {
  const [personas, setPersonas] = useState<PersonaLite[]>([]);
  const [rels, setRels] = useState<any[]>([]);
  const [center, setCenter] = useState<string>("");
  const [probandLocked, setProbandLocked] = useState(false);
  const [generaciones, setGeneraciones] = useState(4);
  const [zoom, setZoom] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [vista, setVista] = useState<Vista>("ascendientes");
  const [dropTarget, setDropTarget] = useState<{ source: string; target: string } | null>(null);
  const [lastUndo, setLastUndo] = useState<{ ids: string[]; label: string } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [categoria, setCategoria] = useState<Categoria>("predeterminada");
  const [docsByPersona, setDocsByPersona] = useState<Map<string, number>>(new Map());
  const [loadingTree, setLoadingTree] = useState(true);
  const [agentProgress, setAgentProgress] = useState<{ total: number; done: number; ok: number; running: boolean; errors: string[] }>({ total: 0, done: 0, ok: 0, running: false, errors: [] });

  useEffect(() => {
    (async () => {
      setLoadingTree(true);
      const user = (await supabase.auth.getUser()).data.user;
      const [{ data: p }, { data: r }, profRes, { data: docs }] = await Promise.all([
        supabase.from("personas").select("id,nombres,apellidos,sexo,nac_fecha,nac_rango_ini,defuncion_fecha,viva,nacionalidad").order("apellidos"),
        supabase.from("relaciones").select("id,persona_id,pariente_id,tipo"),
        user ? supabase.from("profiles").select("proband_id").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null } as any),
        supabase.from("documentos").select("personas_mencionadas"),
      ]);
      setPersonas((p as any) ?? []);
      setRels(r ?? []);
      const counts = new Map<string, number>();
      for (const d of docs ?? []) {
        for (const pid of (d as any).personas_mencionadas ?? []) counts.set(pid, (counts.get(pid) ?? 0) + 1);
      }
      setDocsByPersona(counts);
      const probandId = (profRes as any)?.data?.proband_id;
      const valid = probandId && p?.some((x: any) => x.id === probandId);
      if (valid) {
        setCenter(probandId);
        setProbandLocked(true);
      } else if (!center && p?.length) {
        setCenter(p[0].id);
      }
      setLoadingTree(false);
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
    if (!confirm("⚠️ Esto eliminará TODAS las personas, relaciones y eventos de tu árbol. ¿Continuar?")) return;
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
    const rows = pairs.map((p) => ({ ...p, user_id: user.id, naturaleza: "biologica" as const, certeza: "probable" as const }));
    const { data, error } = await supabase.from("relaciones").insert(rows).select("id");
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

  // Wrapper: in edit mode = drag/drop + delete badge; otherwise click focuses on that ancestor
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
    if (focusable && p.id !== center && !probandLocked) {
      // override default navigation: single click focuses on this person in the tree
      return (
        <div className="relative group">
          <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCenter(p.id); toast.success(`Centro: ${p.nombres}`, { duration: 1200 }); }}>
            <PersonCardClickIntercept>{children}</PersonCardClickIntercept>
          </div>
          <Link
            to={`/personas/${p.id}`}
            onClick={(e) => e.stopPropagation()}
            className="absolute -top-2 -right-2 z-10 hidden group-hover:grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground shadow-md text-[10px]"
            title="Abrir ficha completa"
          >→</Link>
        </div>
      );
    }
    return <>{children}</>;
  };

  // Swallows the inner PersonCard's button click so our outer onClick wins
  const PersonCardClickIntercept = ({ children }: { children: React.ReactNode }) => (
    <div onClickCapture={(e) => { e.preventDefault(); e.stopPropagation(); }}>{children}</div>
  );

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

  // Recursive ascendants renderer — FamilySearch-style with visible connector lines
  const Ascendants = ({ pid, gen }: { pid: string; gen: number }) => {
    if (gen <= 0) return null;
    const { padre, madre } = padresDe(pid);
    const hasAny = !!(padre || madre);
    return (
      <div className="flex flex-col items-center">
        <div className="relative flex flex-wrap items-end justify-center gap-4 px-3 pb-3">
          {/* horizontal bar joining the two parents */}
          {padre && madre && (
            <div className="pointer-events-none absolute bottom-1 left-1/2 h-px w-[55%] -translate-x-1/2 bg-foreground/30" />
          )}
          <div className="flex flex-col items-center gap-2">
            {padre ? <Ascendants pid={padre.id} gen={gen - 1} /> : null}
            {padre ? (
              <Draggable p={padre}><Hl p={padre}><PersonCard p={padre} compact /></Hl></Draggable>
            ) : (
              <QuickAddRelative personaId={pid} defaultTipo="padre" onAdded={reload}
                trigger={<button className="block"><EmptySlot label="padre" onClick={() => {}} /></button>} />
            )}
          </div>
          <div className="flex flex-col items-center gap-2">
            {madre ? <Ascendants pid={madre.id} gen={gen - 1} /> : null}
            {madre ? (
              <Draggable p={madre}><Hl p={madre}><PersonCard p={madre} compact /></Hl></Draggable>
            ) : (
              <QuickAddRelative personaId={pid} defaultTipo="madre" onAdded={reload}
                trigger={<button className="block"><EmptySlot label="madre" onClick={() => {}} /></button>} />
            )}
          </div>
        </div>
        {/* vertical drop line to the child below */}
        {hasAny && <div className="h-4 w-px bg-foreground/30" />}
      </div>
    );
  };

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
    const agentJobs = [
      { titulo: "Biografía automática", body: { person_id: pid }, fn: "biografia-auto" },
      { titulo: "Ascendientes posibles", body: { person_id: pid, foco: "ascendientes" }, fn: "investigar-auto" },
      { titulo: "Descendientes posibles", body: { person_id: pid, foco: "descendientes" }, fn: "investigar-auto" },
      { titulo: "Coherencia y fuentes faltantes", body: { person_id: pid }, fn: "investigar-auto" },
    ];
    setAgentProgress({ total: agentJobs.length, done: 0, ok: 0, running: true, errors: [] });
    const t = toast.loading("Desplegando agentes en paralelo…");
    try {
      await supabase.from("research_tasks").insert(agentJobs.map((job) => ({
        user_id: user.id,
        person_id: pid,
        tipo: "otro" as const,
        descripcion: `Agente en paralelo: ${job.titulo}`,
      })));
      const results = await Promise.allSettled(agentJobs.map(async (job) => {
        try {
          const res = await supabase.functions.invoke(job.fn, { body: job.body });
          if (res.error) throw res.error;
          setAgentProgress((p) => ({ ...p, ok: p.ok + 1 }));
          return res;
        } finally {
          setAgentProgress((p) => ({ ...p, done: Math.min(p.total, p.done + 1) }));
        }
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
            ["ascendientes", GitBranch, "Clásica"],
            ["abanico", Sparkles, "Abanico"],
            ["dinastica", LayoutGrid, "Dinástica"],
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

      {/* Compact selector row */}
      <div className="mb-3 flex items-center gap-2 px-3 md:px-6">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Select
            value={center}
            onValueChange={(v) => {
              if (probandLocked) {
                toast.info("La persona principal ya está fijada y no se puede cambiar.");
                return;
              }
              setCenter(v);
            }}
            disabled={probandLocked}
          >
            <SelectTrigger
              className="h-9 rounded-full pl-9 text-xs disabled:opacity-100 disabled:cursor-default"
              title={probandLocked ? "Persona principal fijada" : "Persona central"}
            >
              <SelectValue placeholder="Persona central" />
            </SelectTrigger>
            <SelectContent>
              {personas.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nombres} {p.apellidos}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Select value={String(generaciones)} onValueChange={(v) => setGeneraciones(parseInt(v))}>
          <SelectTrigger className="h-9 w-[92px] rounded-full text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2, 3, 4, 5, 6, 8, 10].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} gen</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
          🖱️ Arrastra una persona <strong>sobre otra</strong> para crear una relación.
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


      {loadingTree ? (
        <div className="grid min-h-[45vh] place-items-center rounded-2xl border border-border bg-card/60">
          <div className="text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />Cargando árbol…</div>
        </div>
      ) : !persona ? (
        <p className="text-muted-foreground">Selecciona una persona o crea la primera en Personas.</p>
      ) : vista === "abanico" ? (
        <div className="overflow-x-auto pb-24 md:pb-8">
          <div className="mx-auto origin-top transition-transform" style={{ transform: `scale(${zoom})`, width: "max-content" }}>
            <FanChart personas={personas} rels={rels} centerId={persona.id} generations={Math.min(generaciones, 6)} size={760} />
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-500" /> línea paterna ·{" "}
            <span className="inline-block h-2 w-2 rounded-full bg-pink-500" /> línea materna
          </p>
        </div>
      ) : vista === "dinastica" ? (
        <div className="overflow-x-auto pb-24 md:pb-8">
          <div className="mx-auto origin-top transition-transform" style={{ transform: `scale(${zoom})`, minWidth: "max-content" }}>
            <DynastyView personas={personas} rels={rels} centerId={persona.id} generations={Math.min(generaciones, 5)} />
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto pb-24 md:pb-8">
          <div
            className="mx-auto flex flex-col items-center gap-6 origin-top transition-transform"
            style={{ transform: `scale(${zoom})`, minWidth: "max-content" }}
          >
            <Ascendants pid={persona.id} gen={generaciones} />

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Draggable p={persona}><Hl p={persona}><PersonCard p={persona} highlighted onClick={() => setCenter(persona.id)} /></Hl></Draggable>
              {conyugesDe(persona.id).map((c) => (
                <Draggable key={c.id} p={c}><Hl p={c}><PersonCard p={c} /></Hl></Draggable>
              ))}
              <QuickAddRelative personaId={persona.id} defaultTipo="conyuge" onAdded={reload}
                trigger={<button className="block"><EmptySlot label="cónyuge" onClick={() => {}} /></button>} />
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {hijosDe(persona.id).map((h) => (
                <Draggable key={h.id} p={h}><Hl p={h}><PersonCard p={h} compact /></Hl></Draggable>
              ))}
              <QuickAddRelative personaId={persona.id} defaultTipo="hijo" onAdded={reload}
                trigger={<button className="block"><EmptySlot label="hijo/a" onClick={() => {}} /></button>} />
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
                    ["padre", "Padre / madre"],
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
