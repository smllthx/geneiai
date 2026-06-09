import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, GlassCard, EmptyState } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image as ImageIcon, Upload, X, Tag, Trash2, Sparkles, MapPin, Users, Album } from "lucide-react";
import { toast } from "sonner";
import { MapContainer, TileLayer, CircleMarker, Tooltip as LTooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { localPhotoAnalysis } from "@/lib/offlineAi";
import { applyTreeScope, fetchAllPeople, getActiveTreeId, withTreeScope } from "@/lib/peopleData";

type FotoRow = {
  id: string; url: string; storage_path: string | null;
  titulo: string | null; descripcion: string | null;
  fecha: string | null; fecha_aprox: string | null; lugar_id: string | null;
  personas_ids: string[] | null; created_at: string;
};
type Persona = { id: string; nombres: string; apellidos: string };
type Lugar = { id: string; ciudad: string | null; pais: string | null; lat: number | null; lng: number | null };
type FotoTag = { id: string; foto_id: string; persona_id: string; x: number; y: number; w: number; h: number };

export default function Fotos() {
  const [fotos, setFotos] = useState<FotoRow[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [lugares, setLugares] = useState<Lugar[]>([]);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [desc, setDesc] = useState("");
  const [fechaAprox, setFechaAprox] = useState("");
  const [busy, setBusy] = useState(false);
  const [detalle, setDetalle] = useState<FotoRow | null>(null);

  const load = async () => {
    try {
      const treeId = await getActiveTreeId();
      const fotosQuery = supabase.from("fotos").select("*").order("created_at", { ascending: false });
      const [{ data: f, error: fotosError }, p, { data: l, error: lugaresError }] = await Promise.all([
        applyTreeScope(fotosQuery as any, treeId),
        fetchAllPeople<Persona>("id,nombres,apellidos", { treeId }),
        supabase.from("lugares").select("id,ciudad,pais,lat,lng"),
      ]);
      if (fotosError) throw fotosError;
      if (lugaresError) throw lugaresError;
      setFotos((f as any) ?? []); setPersonas((p as any) ?? []); setLugares((l as any) ?? []);
    } catch (e: any) {
      toast.error(e.message ?? "No se pudieron cargar las fotos");
      setFotos([]);
      setPersonas([]);
      setLugares([]);
    }
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
      const treeId = await getActiveTreeId(user.id);
      const { data: { publicUrl } } = supabase.storage.from("fotos").getPublicUrl(path);
      const { data: inserted, error: insErr } = await supabase.from("fotos").insert(withTreeScope({
        user_id: user.id, url: publicUrl, storage_path: path,
        titulo, descripcion: desc, fecha_aprox: fechaAprox,
      }, treeId)).select().single();
      if (insErr) throw insErr;
      toast.success("Foto subida");
      setFile(null); setTitulo(""); setDesc(""); setFechaAprox(""); setOpen(false);
      load();

      // Análisis contextual local en segundo plano; no bloquea la subida.
      if (inserted?.id) {
        const a = localPhotoAnalysis({ titulo, descripcion: desc, fechaAprox });
        await supabase.from("fotos").update({ descripcion: a.descripcion, fecha_aprox: a.ano_estimado ? String(a.ano_estimado) : (a.decada_estimada ?? fechaAprox) }).eq("id", inserted.id);
        toast.success("Análisis local agregado");
        load();
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  // ------- Memorias automáticas: agrupar por año o por persona -------
  const memorias = useMemo(() => {
    const out: Array<{ id: string; titulo: string; subtitulo: string; cover: FotoRow; fotos: FotoRow[] }> = [];
    // Por año
    const porAno = new Map<string, FotoRow[]>();
    for (const f of fotos) {
      const y = f.fecha?.slice(0, 4) ?? (f.fecha_aprox?.match(/\d{4}/)?.[0]);
      if (!y) continue;
      if (!porAno.has(y)) porAno.set(y, []);
      porAno.get(y)!.push(f);
    }
    [...porAno.entries()].sort((a, b) => b[0].localeCompare(a[0])).forEach(([y, list]) => {
      if (list.length >= 2) out.push({ id: `y-${y}`, titulo: `Recuerdos de ${y}`, subtitulo: `${list.length} fotos`, cover: list[0], fotos: list });
    });
    // Por persona
    const porPersona = new Map<string, FotoRow[]>();
    for (const f of fotos) (f.personas_ids ?? []).forEach((pid) => {
      if (!porPersona.has(pid)) porPersona.set(pid, []);
      porPersona.get(pid)!.push(f);
    });
    [...porPersona.entries()].forEach(([pid, list]) => {
      if (list.length >= 3) {
        const p = personas.find((x) => x.id === pid);
        if (p) out.push({ id: `p-${pid}`, titulo: `${p.nombres} ${p.apellidos.split(" ")[0]} a través del tiempo`, subtitulo: `${list.length} fotos`, cover: list[0], fotos: list });
      }
    });
    return out.slice(0, 8);
  }, [fotos, personas]);

  // ------- Álbumes por persona -------
  const albumes = useMemo(() => {
    return personas
      .map((p) => ({ p, fotos: fotos.filter((f) => (f.personas_ids ?? []).includes(p.id)) }))
      .filter((a) => a.fotos.length > 0)
      .sort((a, b) => b.fotos.length - a.fotos.length);
  }, [personas, fotos]);

  // ------- Lugares con fotos -------
  const lugaresConFotos = useMemo(() => {
    const map = new Map<string, { lugar: Lugar; fotos: FotoRow[] }>();
    for (const f of fotos) {
      if (!f.lugar_id) continue;
      const lg = lugares.find((x) => x.id === f.lugar_id);
      if (!lg) continue;
      if (!map.has(lg.id)) map.set(lg.id, { lugar: lg, fotos: [] });
      map.get(lg.id)!.fotos.push(f);
    }
    return [...map.values()];
  }, [fotos, lugares]);

  const subirAccion = (
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
  );

  return (
    <div>
      <SectionHeader
        eyebrow="Galería familiar"
        title="Fotos"
        subtitle="Estilo Apple Photos: galería, memorias automáticas, álbumes por persona, mapa de lugares."
        actions={subirAccion}
      />

      {fotos.length === 0 ? (
        <EmptyState icon={<ImageIcon className="h-5 w-5" />} title="Sin fotos todavía" description="Sube tu primera foto para empezar a crear álbumes y memorias." />
      ) : (
        <Tabs defaultValue="galeria">
          <TabsList className="glass-strong rounded-2xl p-1">
            <TabsTrigger value="galeria"><ImageIcon className="h-3.5 w-3.5" /> Galería</TabsTrigger>
            <TabsTrigger value="memorias"><Sparkles className="h-3.5 w-3.5" /> Memorias</TabsTrigger>
            <TabsTrigger value="albumes"><Album className="h-3.5 w-3.5" /> Álbumes</TabsTrigger>
            <TabsTrigger value="personas"><Users className="h-3.5 w-3.5" /> Personas</TabsTrigger>
            <TabsTrigger value="lugares"><MapPin className="h-3.5 w-3.5" /> Lugares</TabsTrigger>
          </TabsList>

          <TabsContent value="galeria" className="mt-4">
            <Mosaic fotos={fotos} onOpen={setDetalle} />
          </TabsContent>

          <TabsContent value="memorias" className="mt-4">
            {memorias.length === 0 ? (
              <p className="text-sm text-muted-foreground">Añade fechas y etiqueta personas para generar memorias automáticas.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {memorias.map((m) => (
                  <button key={m.id} onClick={() => setDetalle(m.cover)} className="glass group relative aspect-[4/3] overflow-hidden rounded-3xl text-left">
                    <img src={m.cover.url} alt={m.titulo} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                      <p className="font-serif text-xl drop-shadow-md">{m.titulo}</p>
                      <p className="text-xs opacity-80">{m.subtitulo}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="albumes" className="mt-4">
            {albumes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Etiqueta personas en las fotos para crear álbumes.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {albumes.map(({ p, fotos: fp }) => (
                  <GlassCard key={p.id} className="overflow-hidden p-0">
                    <button onClick={() => setDetalle(fp[0])} className="block w-full text-left">
                      <div className="grid aspect-square grid-cols-2 grid-rows-2 gap-0.5">
                        {fp.slice(0, 4).map((f) => (
                          <img key={f.id} src={f.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ))}
                        {Array.from({ length: Math.max(0, 4 - fp.length) }).map((_, i) => (
                          <div key={i} className="bg-muted/40" />
                        ))}
                      </div>
                      <div className="p-3">
                        <p className="truncate font-medium">{p.nombres} {p.apellidos.split(" ")[0]}</p>
                        <p className="text-xs text-muted-foreground">{fp.length} fotos</p>
                      </div>
                    </button>
                  </GlassCard>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="personas" className="mt-4">
            <div className="flex flex-wrap gap-2">
              {personas.map((p) => {
                const n = fotos.filter((f) => (f.personas_ids ?? []).includes(p.id)).length;
                if (n === 0) return null;
                return (
                  <Link key={p.id} to={`/personas/${p.id}`} className="glass-pill">
                    {p.nombres} {p.apellidos.split(" ")[0]} · {n}
                  </Link>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="lugares" className="mt-4 space-y-4">
            {lugaresConFotos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Vincula fotos a lugares geolocalizados para verlas en el mapa.</p>
            ) : (
              <>
                <div className="overflow-hidden rounded-3xl" style={{ height: 360 }}>
                  <MapContainer center={[20, 0]} zoom={2} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
                    <TileLayer attribution='&copy; OpenStreetMap'
                      url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                    {lugaresConFotos.filter((x) => x.lugar.lat && x.lugar.lng).map((x) => (
                      <CircleMarker key={x.lugar.id} center={[x.lugar.lat!, x.lugar.lng!]} radius={Math.min(5 + x.fotos.length * 2, 16)}
                        pathOptions={{ color: "hsl(211, 100%, 50%)", fillColor: "hsl(211, 100%, 50%)", fillOpacity: 0.6, weight: 1 }}>
                        <LTooltip>{x.lugar.ciudad ?? x.lugar.pais ?? "Lugar"} · {x.fotos.length}</LTooltip>
                      </CircleMarker>
                    ))}
                  </MapContainer>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {lugaresConFotos.map((x) => (
                    <GlassCard key={x.lugar.id} className="overflow-hidden p-0">
                      <div className="grid aspect-video grid-cols-3 gap-0.5">
                        {x.fotos.slice(0, 3).map((f) => <img key={f.id} src={f.url} alt="" className="h-full w-full object-cover" loading="lazy" />)}
                      </div>
                      <div className="p-3">
                        <p className="font-medium">{[x.lugar.ciudad, x.lugar.pais].filter(Boolean).join(", ") || "Lugar"}</p>
                        <p className="text-xs text-muted-foreground">{x.fotos.length} fotos</p>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        <DialogContent className="max-w-4xl">
          {detalle && (
            <FotoDetalle foto={detalle} personas={personas}
              onClose={() => setDetalle(null)}
              onDeleted={() => { setDetalle(null); load(); }} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Mosaic({ fotos, onOpen }: { fotos: FotoRow[]; onOpen: (f: FotoRow) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {fotos.map((f, i) => (
        <button key={f.id} onClick={() => onOpen(f)}
          className={`glass group overflow-hidden rounded-2xl text-left transition-transform hover:scale-[1.02] ${i % 7 === 0 ? "row-span-2 col-span-2" : ""}`}>
          <div className={i % 7 === 0 ? "aspect-square" : "aspect-square"}>
            <img src={f.url} alt={f.titulo ?? "foto"} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
          </div>
        </button>
      ))}
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
    if (drawing && drawing.w > 2 && drawing.h > 2) setPendingTag(drawing);
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
