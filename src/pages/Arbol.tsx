import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader } from "@/components/glass";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PersonCard, EmptySlot, type PersonaLite } from "@/components/PersonCard";
import QuickAddRelative from "@/components/QuickAddRelative";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Crosshair, Pencil, ZoomIn, ZoomOut, Undo2, GitBranch, LayoutGrid, Sparkles } from "lucide-react";
import { toast } from "sonner";
import FanChart from "@/components/FanChart";
import DynastyView from "@/components/DynastyView";

type RelTipo = "padre" | "madre" | "hijo" | "conyuge" | "hermano";
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

  const byId = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas]);

  const padresDe = (pid: string) => {
    const padreIds = rels
      .filter((r) => r.persona_id === pid && (r.tipo === "padre" || r.tipo === "madre"))
      .map((r) => ({ id: r.pariente_id, tipo: r.tipo }));
    const padre = padreIds.find((x) => x.tipo === "padre" || (byId.get(x.id)?.sexo === "masculino"));
    const madre = padreIds.find((x) => x.tipo === "madre" || (byId.get(x.id)?.sexo === "femenino"));
    return { padre: padre ? byId.get(padre.id) : undefined, madre: madre ? byId.get(madre.id) : undefined };
  };

  const conyugesDe = (pid: string) =>
    rels.filter((r) => (r.persona_id === pid || r.pariente_id === pid) && r.tipo === "conyuge")
      .map((r) => byId.get(r.persona_id === pid ? r.pariente_id : r.persona_id))
      .filter(Boolean) as PersonaLite[];

  const hijosDe = (pid: string) => {
    const ids = new Set<string>();
    for (const r of rels) {
      if (r.pariente_id === pid && (r.tipo === "padre" || r.tipo === "madre")) ids.add(r.persona_id);
      if (r.persona_id === pid && r.tipo === "hijo") ids.add(r.pariente_id);
    }
    return [...ids].map((i) => byId.get(i)).filter(Boolean) as PersonaLite[];
  };

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

  // Wrapper that makes a card draggable+droppable in edit mode
  const Draggable = ({ p, children }: { p: PersonaLite; children: React.ReactNode }) => {
    if (!editMode) return <>{children}</>;
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
        className="ring-2 ring-accent/40 rounded-3xl cursor-grab active:cursor-grabbing"
      >
        {children}
      </div>
    );
  };

  // Recursive ascendants renderer
  const Ascendants = ({ pid, gen }: { pid: string; gen: number }) => {
    if (gen <= 0) return null;
    const { padre, madre } = padresDe(pid);
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap items-end justify-center gap-3">
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
      </div>
    );
  };

  return (
    <div>
      <SectionHeader
        eyebrow="Genealogía visual"
        title="Árbol familiar"
        subtitle="Persona central abajo, ancestros hacia arriba. Activa Editar para conectar personas arrastrando."
      />

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
    </div>
  );
}
