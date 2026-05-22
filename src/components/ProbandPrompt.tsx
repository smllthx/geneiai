import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sparkles, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Pers = { id: string; nombres: string; apellidos: string; nac_fecha?: string | null };

export default function ProbandPrompt() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [personas, setPersonas] = useState<Pers[]>([]);
  const [sel, setSel] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("proband_id, proband_asked")
        .eq("id", user.id)
        .maybeSingle();
      if (!prof || prof.proband_id || prof.proband_asked) return;
      const { data: p } = await supabase
        .from("personas")
        .select("id,nombres,apellidos,nac_fecha")
        .order("apellidos");
      setPersonas((p as any) ?? []);
      // Suggest the youngest as default proband
      if (p && p.length) {
        const sorted = [...p].sort((a: any, b: any) =>
          String(b.nac_fecha ?? "").localeCompare(String(a.nac_fecha ?? "")));
        setSel(sorted[0]?.id ?? "");
      }
      setOpen(true);
    })();
  }, [user]);

  const guardar = async (skip = false) => {
    if (!user) return;
    setSaving(true);
    const payload: any = { proband_asked: true };
    if (!skip && sel) payload.proband_id = sel;
    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    if (!skip && sel) toast.success("Persona principal del árbol guardada");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && guardar(true)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Sparkles className="h-5 w-5 text-primary" /> ¿Quién es la persona principal?
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Elegí desde quién se construye tu árbol. Suele ser <strong>tú mismo/a</strong> o el descendiente más reciente.
          Toda la app (árbol, investigaciones, insights) se centrará en esa persona por defecto.
        </p>

        {personas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            <User className="mx-auto mb-2 h-6 w-6 opacity-60" />
            Todavía no tenés personas cargadas. Creá la primera y volveremos a preguntarte.
          </div>
        ) : (
          <Select value={sel} onValueChange={setSel}>
            <SelectTrigger><SelectValue placeholder="Elegí la persona principal" /></SelectTrigger>
            <SelectContent>
              {personas.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombres} {p.apellidos}
                  {p.nac_fecha ? ` · ${new Date(p.nac_fecha).getUTCFullYear()}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => guardar(true)} disabled={saving}>Más tarde</Button>
          <Button onClick={() => guardar(false)} disabled={!sel || saving}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
