import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";

export default function Documentos() {
  const [items, setItems] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>({ titulo: "", tipo: "otro", fecha: "", estado: "pendiente", transcripcion: "", cita: "", repositorio: "", personas_mencionadas: [] });
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    const [{ data }, { data: ps }] = await Promise.all([
      supabase.from("documentos").select("*").order("created_at", { ascending: false }),
      supabase.from("personas").select("id,nombres,apellidos"),
    ]);
    setItems(data ?? []); setPersonas(ps ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!draft.titulo) return toast.error("Falta título");
    const user = (await supabase.auth.getUser()).data.user!;
    let archivo_path: string | null = null;
    if (file) {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("documentos").upload(path, file);
      if (error) return toast.error(error.message);
      archivo_path = path;
    }
    const { error } = await supabase.from("documentos").insert({ ...draft, fecha: draft.fecha || null, archivo_path, user_id: user.id });
    if (error) return toast.error(error.message);
    toast.success("Documento creado");
    setDraft({ titulo: "", tipo: "otro", fecha: "", estado: "pendiente", transcripcion: "", cita: "", repositorio: "", personas_mencionadas: [] });
    setFile(null); load();
  };

  const del = async (id: string) => { await supabase.from("documentos").delete().eq("id", id); load(); };

  return (
    <div>
      <PageHeader title="Documentos y fuentes" subtitle="Actas, partidas, pasaportes, fotos. Toda evidencia que respalda los datos." />

      <Card className="archivo-card mb-6"><CardContent className="grid gap-3 pt-6 md:grid-cols-2">
        <div><Label>Título</Label><Input value={draft.titulo} onChange={(e) => setDraft({ ...draft, titulo: e.target.value })} /></div>
        <div><Label>Tipo</Label>
          <Select value={draft.tipo} onValueChange={(v) => setDraft({ ...draft, tipo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["acta_civil","partida_parroquial","pasaporte","lista_pasajeros","censo","foto","certificado","lapida","carta","otro"].map((t) =>
              <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select></div>
        <div><Label>Fecha</Label><Input type="date" value={draft.fecha} onChange={(e) => setDraft({ ...draft, fecha: e.target.value })} /></div>
        <div><Label>Estado</Label>
          <Select value={draft.estado} onValueChange={(v) => setDraft({ ...draft, estado: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["pendiente","transcrito","verificado","dudoso"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="md:col-span-2"><Label>Transcripción</Label><Textarea rows={3} value={draft.transcripcion} onChange={(e) => setDraft({ ...draft, transcripcion: e.target.value })} /></div>
        <div><Label>Cita / referencia</Label><Input value={draft.cita} onChange={(e) => setDraft({ ...draft, cita: e.target.value })} /></div>
        <div><Label>Repositorio / archivo</Label><Input value={draft.repositorio} onChange={(e) => setDraft({ ...draft, repositorio: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Archivo (PDF / imagen)</Label>
          <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        <div className="md:col-span-2 flex gap-2"><Button onClick={add}><Plus className="h-4 w-4" /> {file && <Upload className="h-4 w-4" />} Añadir documento</Button></div>
      </CardContent></Card>

      <div className="grid gap-2">
        {items.map((d) => (
          <Card key={d.id} className="archivo-card"><CardContent className="flex items-start justify-between gap-2 pt-4">
            <div>
              <div className="font-serif text-lg">{d.titulo}</div>
              <div className="text-xs text-muted-foreground">{d.tipo} · {d.fecha ?? "s/f"} · {d.estado}</div>
              {d.transcripcion && <p className="mt-1 line-clamp-2 text-sm">{d.transcripcion}</p>}
            </div>
            <Button size="sm" variant="ghost" onClick={() => del(d.id)}><Trash2 className="h-4 w-4" /></Button>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
