import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, GlassCard, EmptyState } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { toast } from "sonner";

export default function Fotos() {
  const [fotos, setFotos] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [desc, setDesc] = useState("");
  const [fechaAprox, setFechaAprox] = useState("");
  const [busy, setBusy] = useState(false);
  const [filtroPersona, setFiltroPersona] = useState<string>("");
  const [detalle, setDetalle] = useState<any | null>(null);

  const load = async () => {
    const [{ data: f }, { data: p }] = await Promise.all([
      supabase.from("fotos").select("*").order("created_at", { ascending: false }),
      supabase.from("personas").select("id,nombres,apellidos").order("apellidos"),
    ]);
    setFotos(f ?? []); setPersonas(p ?? []);
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
        subtitle="Sube y organiza fotos vinculadas a personas, fechas y lugares de tu árbol."
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
        <EmptyState icon={<ImageIcon className="h-5 w-5" />} title="Sin fotos todavía" description="Sube fotos para enriquecer las fichas y la línea de tiempo." />
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

      <Dialog open={!!detalle} onOpenChange={() => setDetalle(null)}>
        <DialogContent className="max-w-3xl">
          {detalle && (
            <>
              <DialogHeader><DialogTitle>{detalle.titulo || "Foto"}</DialogTitle></DialogHeader>
              <img src={detalle.url} alt={detalle.titulo ?? ""} className="max-h-[60vh] w-full rounded-xl object-contain" />
              {detalle.descripcion && <p className="text-sm">{detalle.descripcion}</p>}
              {detalle.fecha_aprox && <p className="text-xs text-muted-foreground">📅 {detalle.fecha_aprox}</p>}
              <Button variant="outline" onClick={async () => {
                if (!confirm("¿Eliminar foto?")) return;
                await supabase.storage.from("fotos").remove([detalle.storage_path]);
                await supabase.from("fotos").delete().eq("id", detalle.id);
                setDetalle(null); load();
              }}><X className="h-4 w-4" /> Eliminar</Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
