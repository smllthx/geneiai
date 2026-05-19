import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader } from "@/components/glass";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PersonCard, EmptySlot, type PersonaLite } from "@/components/PersonCard";
import QuickAddRelative from "@/components/QuickAddRelative";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Crosshair, Pencil, ZoomIn, ZoomOut, Undo2, GitBranch, LayoutGrid, Sparkles, Maximize2, Minimize2, FileDown, Trash2, X, Focus } from "lucide-react";
import { toast } from "sonner";
import FanChart from "@/components/FanChart";
import DynastyView from "@/components/DynastyView";
import { padresDe as kPadresDe, conyugesDe as kConyugesDe, hijosDe as kHijosDe, relacionesEntre, type RelTipo } from "@/lib/kinship";

type Vista = "ascendientes" | "abanico" | "dinastica";

export default function Arbol() {
  const [personas, setPersonas] = useState<PersonaLite[]>([]);
  const [rels, setRels] = useState<any[]>([]);
  const [center, setCenter] = useState<string>("");
  const [generaciones, setGeneraciones] = useState(4);
  const [zoom, setZoom] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [vista, setVista] = useState<Vista>("ascendientes");
  const [dropTarget, setDropTarget] = useState<{ source: string; target: string } | null>(null);
  const [lastUndo, setLastUndo] = useState<{ ids: string[]; label: string } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("personas").select("id,nombres,apellidos,sexo,nac_fecha,nac_rango_ini,defuncion_fecha,viva").order("apellidos"),
        supabase.from("relaciones").select("id,persona_id,pariente_id,tipo"),
      ]);
      setPersonas((p as any) ?? []);
      setRels(r ?? []);
      if (!center && p?.[0]) setCenter(p[0].id);
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
    if (focusable && p.id !== center) {
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
              <Draggable p={padre}><PersonCard p={padre} compact /></Draggable>
            ) : (
              <QuickAddRelative personaId={pid} defaultTipo="padre" onAdded={reload}
                trigger={<button className="block"><EmptySlot label="padre" onClick={() => {}} /></button>} />
            )}
          </div>
          <div className="flex flex-col items-center gap-2">
            {madre ? <Ascendants pid={madre.id} gen={gen - 1} /> : null}
            {madre ? (
              <Draggable p={madre}><PersonCard p={madre} compact /></Draggable>
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

  return (
    <div className={fullscreen ? "fixed inset-0 z-[100] bg-background overflow-y-auto p-3 md:p-6" : ""} style={fullscreen ? { paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" } : undefined}>
      <SectionHeader
        eyebrow="Genealogía visual"
        title="Árbol familiar"
        subtitle="Elige una vista: ascendientes clásica, abanico radial o dinástica generacional. Activa Editar para conectar personas arrastrando."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="glass inline-flex rounded-2xl p-1">
          {([
            ["ascendientes", GitBranch, "Ascendientes"],
            ["abanico", Sparkles, "Abanico"],
            ["dinastica", LayoutGrid, "Dinástica"],
          ] as [Vista, any, string][]).map(([k, Icon, label]) => (
            <button
              key={k}
              onClick={() => setVista(k)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                vista === k ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-foreground/5"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <Select value={center} onValueChange={setCenter}>
            <SelectTrigger><SelectValue placeholder="Elegir persona central" /></SelectTrigger>
            <SelectContent>
              {personas.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nombres} {p.apellidos}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Select value={String(generaciones)} onValueChange={(v) => setGeneraciones(parseInt(v))}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2, 3, 4, 5, 6, 8, 10].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} generaciones</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant={editMode ? "default" : "outline"} size="sm" onClick={() => setEditMode((v) => !v)}>
          <Pencil className="h-4 w-4" /> {editMode ? "Editando" : "Editar relaciones"}
        </Button>
        <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} aria-label="Alejar"><ZoomOut className="h-4 w-4" /></Button>
        <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))} aria-label="Acercar"><ZoomIn className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={() => setZoom(1)}><Crosshair className="h-4 w-4" /> Centrar</Button>
        <Button variant={fullscreen ? "default" : "outline"} size="sm" onClick={() => setFullscreen((v) => !v)}>
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {fullscreen ? "Salir pantalla completa" : "Pantalla completa"}
        </Button>
        <Button variant="outline" size="sm" onClick={exportarGedcom}><FileDown className="h-4 w-4" /> Crear archivo del árbol</Button>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={eliminarTodoElArbol}><Trash2 className="h-4 w-4" /> Eliminar todo el árbol</Button>
        {lastUndo && (
          <Button variant="ghost" size="sm" onClick={async () => {
            await supabase.from("relaciones").delete().in("id", lastUndo.ids);
            setLastUndo(null); reload();
          }}><Undo2 className="h-4 w-4" /> Deshacer</Button>
        )}
      </div>

      {editMode && (
        <p className="mb-3 rounded-xl bg-accent/10 border border-accent/30 px-3 py-2 text-xs text-foreground">
          🖱️ Arrastra una persona <strong>sobre otra</strong> para crear una relación entre ambas.
        </p>
      )}

      {!persona ? (
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
              <Draggable p={persona}><PersonCard p={persona} highlighted /></Draggable>
              {conyugesDe(persona.id).map((c) => (
                <Draggable key={c.id} p={c}><PersonCard p={c} /></Draggable>
              ))}
              <QuickAddRelative personaId={persona.id} defaultTipo="conyuge" onAdded={reload}
                trigger={<button className="block"><EmptySlot label="cónyuge" onClick={() => {}} /></button>} />
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {hijosDe(persona.id).map((h) => (
                <Draggable key={h.id} p={h}><PersonCard p={h} compact /></Draggable>
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
