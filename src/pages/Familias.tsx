import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, GlassCard, EmptyState } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, Plus } from "lucide-react";
import { toast } from "sonner";

export default function Familias() {
  const [familias, setFamilias] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [head, setHead] = useState("");

  const load = async () => {
    const [{ data: f }, { data: p }] = await Promise.all([
      supabase.from("familias").select("*").order("created_at", { ascending: false }),
      supabase.from("personas").select("id,nombres,apellidos").order("apellidos"),
    ]);
    setFamilias(f ?? []); setPersonas(p ?? []);
  };
  useEffect(() => { load(); }, []);

  const crear = async () => {
    const user = (await supabase.auth.getUser()).data.user!;
    const { error } = await supabase.from("familias").insert({
      user_id: user.id, nombre, head_persona_id: head || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Familia creada");
    setOpen(false); setNombre(""); setHead(""); load();
  };

  return (
    <div>
      <SectionHeader
        eyebrow="Unidades familiares"
        title="Familias"
        subtitle="Agrupa personas en unidades familiares con un cabeza de familia para navegar tu árbol por ramas."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Nueva familia</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Crear familia</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nombre de la familia</Label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Familia Sanguineti" /></div>
                <div><Label>Cabeza de familia (opcional)</Label>
                  <Select value={head} onValueChange={setHead}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar persona" /></SelectTrigger>
                    <SelectContent>{personas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombres} {p.apellidos}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={crear} disabled={!nombre}>Crear</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {familias.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-5 w-5" />}
          title="Aún no hay familias"
          description="Crea una familia para agrupar a tus parientes por ramas: Sanguineti, Aeschlimann, etc."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {familias.map((f) => {
            const head = personas.find((p) => p.id === f.head_persona_id);
            return (
              <GlassCard key={f.id} interactive>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent"><Heart className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg font-semibold">{f.nombre}</h3>
                    {head && <p className="text-xs text-muted-foreground">Cabeza: {head.nombres} {head.apellidos}</p>}
                    {f.notas && <p className="mt-2 text-sm">{f.notas}</p>}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
