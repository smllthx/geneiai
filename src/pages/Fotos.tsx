import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, GlassCard, EmptyState } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Image as ImageIcon, Upload, X, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";

type FotoRow = {
  id: string; url: string; storage_path: string | null;
  titulo: string | null; descripcion: string | null; fecha_aprox: string | null;
  personas_ids: string[] | null;
};
type Persona = { id: string; nombres: string; apellidos: string };
type FotoTag = { id: string; foto_id: string; persona_id: string; x: number; y: number; w: number; h: number };

export default function Fotos() {
  const [fotos, setFotos] = useState<FotoRow[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [desc, setDesc] = useState("");
  const [fechaAprox, setFechaAprox] = useState("");
  const [busy, setBusy] = useState(false);
  const [filtroPersona, setFiltroPersona] = useState<string>("");
  const [detalle, setDetalle] = useState<FotoRow | null>(null);

  const load = async () => {
    const [{ data: f }, { data: p }] = await Promise.all([
      supabase.from("fotos").select("*").order("created_at", { ascending: false }),
      supabase.from("personas").select("id,nombres,apellidos").order("apellidos"),
    ]);
    setFotos((f as any) ?? []); setPersonas((p as any) ?? []);
  };
  useEffect(() => { load(); }, []);

  const subir = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const user = (await supabase.auth.getUser()).data.user!;
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("fotos").upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("fotos").getPublicUrl(path);
      const { error: insErr } = await supabase.from("fotos").insert({
        user_id: user.id, url: publicUrl, storage_path: path,
        titulo, descripcion: desc, fecha_aprox: fechaAprox,
      });
      if (insErr) throw insErr;
      toast.success("Foto subida");
      setFile(null); setTitulo(""); setDesc(""); setFechaAprox(""); setOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const visibles = filtroPersona
    ? fotos.filter((f) => (f.personas_ids ?? []).includes(filtroPersona))
    : fotos;

  return (
    <div>
      <SectionHeader
        eyebrow="Galería familiar"
        title="Fotos"
        subtitle="Sube fotos, etiqueta personas con rectángulos y vincúlalas a fechas y lugares."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Upload className="h-4 w-4" /> Subir foto</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Subir nueva foto</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <div><Label>Título</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
                <div><Label>Descripción</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} /></div>
                <div><Label>Fecha aproximada</Label><Input value={fechaAprox} onChange={(e) => setFechaAprox(e.target.value)} placeholder="hacia 1920" /></div>
                <Button onClick={subir} disabled={!file || busy}>{busy ? "Subiendo…" : "Subir"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {personas.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={() => setFiltroPersona("")} className={`glass-pill ${!filtroPersona ? "ring-2 ring-primary" : ""}`}>Todas</button>
          {personas.slice(0, 12).map((p) => (
            <button key={p.id} onClick={() => setFiltroPersona(p.id)}
              className={`glass-pill ${filtroPersona === p.id ? "ring-2 ring-primary" : ""}`}>
              {p.nombres} {p.apellidos.split(" ")[0]}
            </button>
          ))}
        </div>
      )}

      {visibles.length === 0 ? (
        <EmptyState icon={<ImageIcon className="h-5 w-5" />} title="Sin fotos todavía" description="Sube fotos para enriquecer las fichas." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {visibles.map((f) => (
            <button key={f.id} onClick={() => setDetalle(f)} className="glass group overflow-hidden rounded-2xl text-left transition-transform hover:scale-[1.02]">
              <div className="aspect-square overflow-hidden">
                <img src={f.url} alt={f.titulo ?? "foto"} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
              </div>
              <div className="p-2">
                <p className="truncate text-xs font-medium">{f.titulo || "Sin título"}</p>
                {f.fecha_aprox && <p className="truncate text-[10px] text-muted-foreground">{f.fecha_aprox}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        <DialogContent className="max-w-4xl">
          {detalle && (
            <FotoDetalle
              foto={detalle}
              personas={personas}
              onClose={() => setDetalle(null)}
              onDeleted={() => { setDetalle(null); load(); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FotoDetalle({ foto, personas, onClose, onDeleted }: {
  foto: FotoRow; personas: Persona[]; onClose: () => void; onDeleted: () => void;
}) {
  const [tags, setTags] = useState<FotoTag[]>([]);
  const [drawing, setDrawing] = useState<null | { x: number; y: number; w: number; h: number }>(null);
  const [pendingTag, setPendingTag] = useState<null | { x: number; y: number; w: number; h: number }>(null);
  const [pickPersona, setPickPersona] = useState("");
  const [tagMode, setTagMode] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const loadTags = async () => {
    const { data } = await supabase.from("foto_tags").select("*").eq("foto_id", foto.id);
    setTags((data as any) ?? []);
  };
  useEffect(() => { loadTags(); }, [foto.id]);

  const personaName = (id: string) => {
    const p = personas.find((x) => x.id === id);
    return p ? `${p.nombres} ${p.apellidos}` : "?";
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!tagMode || !imgRef.current) return;
    const r = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    startRef.current = { x, y };
    setDrawing({ x, y, w: 0, h: 0 });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing || !startRef.current || !imgRef.current) return;
    const r = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    const nx = Math.min(startRef.current.x, x);
    const ny = Math.min(startRef.current.y, y);
    setDrawing({ x: nx, y: ny, w: Math.abs(x - startRef.current.x), h: Math.abs(y - startRef.current.y) });
  };
  const onPointerUp = () => {
    if (drawing && drawing.w > 2 && drawing.h > 2) {
      setPendingTag(drawing);
    }
    setDrawing(null);
    startRef.current = null;
  };

  const saveTag = async () => {
    if (!pendingTag || !pickPersona) return;
    const user = (await supabase.auth.getUser()).data.user!;
    const { error } = await supabase.from("foto_tags").insert({
      user_id: user.id, foto_id: foto.id, persona_id: pickPersona,
      x: pendingTag.x, y: pendingTag.y, w: pendingTag.w, h: pendingTag.h,
    });
    if (error) return toast.error(error.message);
    // also append to fotos.personas_ids
    const updated = Array.from(new Set([...(foto.personas_ids ?? []), pickPersona]));
    await supabase.from("fotos").update({ personas_ids: updated }).eq("id", foto.id);
    setPendingTag(null); setPickPersona("");
    toast.success("Persona etiquetada");
    loadTags();
  };

  const removeTag = async (id: string) => {
    await supabase.from("foto_tags").delete().eq("id", id);
    loadTags();
  };

  const eliminar = async () => {
    if (!confirm("¿Eliminar foto y sus etiquetas?")) return;
    if (foto.storage_path) await supabase.storage.from("fotos").remove([foto.storage_path]);
    await supabase.from("foto_tags").delete().eq("foto_id", foto.id);
    await supabase.from("fotos").delete().eq("id", foto.id);
    onDeleted();
  };

  return (
    <>
      <DialogHeader><DialogTitle>{foto.titulo || "Foto"}</DialogTitle></DialogHeader>
      <div className="flex items-center gap-2 text-xs">
        <Button size="sm" variant={tagMode ? "default" : "outline"} onClick={() => setTagMode((v) => !v)}>
          <Tag className="h-3 w-3" /> {tagMode ? "Dibujando…" : "Etiquetar persona"}
        </Button>
        <span className="text-muted-foreground">
          {tagMode ? "Arrastra sobre la cara para crear un rectángulo." : `${tags.length} etiqueta(s)`}
        </span>
      </div>
      <div
        ref={imgRef}
        className={`relative w-full overflow-hidden rounded-xl ${tagMode ? "cursor-crosshair" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: tagMode ? "none" : "auto" }}
      >
        <img src={foto.url} alt={foto.titulo ?? ""} className="block max-h-[60vh] w-full object-contain pointer-events-none select-none" draggable={false} />
        {tags.map((t) => (
          <div key={t.id} className="absolute group/tag border-2 border-primary/80 rounded-md"
            style={{ left: `${t.x}%`, top: `${t.y}%`, width: `${t.w}%`, height: `${t.h}%` }}>
            <div className="absolute -bottom-7 left-0 flex items-center gap-1 whitespace-nowrap rounded-md bg-primary px-2 py-0.5 text-xs text-primary-foreground opacity-0 group-hover/tag:opacity-100 transition-opacity">
              <Link to={`/personas/${t.persona_id}`} className="hover:underline">{personaName(t.persona_id)}</Link>
              <button onClick={(e) => { e.stopPropagation(); removeTag(t.id); }} className="ml-1"><X className="h-3 w-3" /></button>
            </div>
          </div>
        ))}
        {drawing && (
          <div className="absolute border-2 border-dashed border-accent bg-accent/10"
            style={{ left: `${drawing.x}%`, top: `${drawing.y}%`, width: `${drawing.w}%`, height: `${drawing.h}%` }} />
        )}
        {pendingTag && (
          <div className="absolute border-2 border-accent bg-accent/10"
            style={{ left: `${pendingTag.x}%`, top: `${pendingTag.y}%`, width: `${pendingTag.w}%`, height: `${pendingTag.h}%` }} />
        )}
      </div>

      {pendingTag && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-foreground/5 p-2">
          <span className="text-sm">Etiquetar como:</span>
          <Select value={pickPersona} onValueChange={setPickPersona}>
            <SelectTrigger className="w-[240px]"><SelectValue placeholder="Elegir persona…" /></SelectTrigger>
            <SelectContent>
              {personas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombres} {p.apellidos}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={saveTag} disabled={!pickPersona}>Guardar</Button>
          <Button size="sm" variant="ghost" onClick={() => { setPendingTag(null); setPickPersona(""); }}>Cancelar</Button>
        </div>
      )}

      {foto.descripcion && <p className="text-sm">{foto.descripcion}</p>}
      {foto.fecha_aprox && <p className="text-xs text-muted-foreground">📅 {foto.fecha_aprox}</p>}
      <div className="flex justify-between">
        <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
        <Button variant="outline" size="sm" onClick={eliminar}><Trash2 className="h-4 w-4" /> Eliminar</Button>
      </div>
    </>
  );
}
