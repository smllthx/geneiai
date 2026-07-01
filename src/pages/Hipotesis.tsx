import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { toDisplayText } from "@/lib/safeText";

export default function Hipotesis() {
  const [items, setItems] = useState<any[]>([]);
  const [d, setD] = useState<any>({ titulo: "", descripcion: "", argumentos_favor: "", argumentos_contra: "", probabilidad: 50, estado: "abierta", proxima_accion: "" });
  const load = async () => { const { data } = await supabase.from("hipotesis").select("*").order("created_at", { ascending: false }); setItems(data ?? []); };
  useEffect(() => { load(); }, []);
  const add = async () => {
    const user = (await supabase.auth.getUser()).data.user!;
    if (!d.titulo) return toast.error("Falta título");
    const { error } = await supabase.from("hipotesis").insert({ ...d, user_id: user.id });
    if (error) return toast.error(error.message);
    setD({ titulo: "", descripcion: "", argumentos_favor: "", argumentos_contra: "", probabilidad: 50, estado: "abierta", proxima_accion: "" });
    load();
  };
  const del = async (id: string) => { await supabase.from("hipotesis").delete().eq("id", id); load(); };
  return (
    <div>
      <PageHeader title="Hipótesis de investigación" subtitle="Lo que crees, con sus argumentos y próxima acción." />
      <Card className="archivo-card mb-6"><CardContent className="grid gap-3 pt-6 md:grid-cols-2">
        <div className="md:col-span-2"><Label>Título</Label><Input value={d.titulo} onChange={(e) => setD({ ...d, titulo: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Descripción</Label><Textarea value={d.descripcion} onChange={(e) => setD({ ...d, descripcion: e.target.value })} /></div>
        <div><Label>Argumentos a favor</Label><Textarea value={d.argumentos_favor} onChange={(e) => setD({ ...d, argumentos_favor: e.target.value })} /></div>
        <div><Label>Argumentos en contra</Label><Textarea value={d.argumentos_contra} onChange={(e) => setD({ ...d, argumentos_contra: e.target.value })} /></div>
        <div><Label>Probabilidad (%)</Label><Input type="number" min={0} max={100} value={d.probabilidad} onChange={(e) => setD({ ...d, probabilidad: parseInt(e.target.value) || 0 })} /></div>
        <div><Label>Estado</Label>
          <Select value={d.estado} onValueChange={(v) => setD({ ...d, estado: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["abierta","probable","confirmada","descartada"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="md:col-span-2"><Label>Próxima acción</Label><Input value={d.proxima_accion} onChange={(e) => setD({ ...d, proxima_accion: e.target.value })} /></div>
        <div><Button onClick={add}>Crear hipótesis</Button></div>
      </CardContent></Card>
      <div className="grid gap-2">{items.map((h) => (
        <Card key={h.id} className="archivo-card"><CardContent className="flex items-start justify-between pt-4">
          <div><div className="font-serif text-lg">{h.titulo}</div>
            <div className="text-xs text-muted-foreground">{h.estado} · {h.probabilidad}%</div>
            <p className="mt-1 text-sm">{toDisplayText(h.descripcion)}</p></div>
          <Button size="sm" variant="ghost" onClick={() => del(h.id)}><Trash2 className="h-4 w-4" /></Button>
        </CardContent></Card>
      ))}</div>
    </div>
  );
}
