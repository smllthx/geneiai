import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

type Tipo = "padre" | "madre" | "conyuge" | "hijo" | "hermano";

const labels: Record<Tipo, string> = {
  padre: "padre", madre: "madre", conyuge: "cónyuge", hijo: "hijo/a", hermano: "hermano/a",
};

export default function QuickAddRelative({
  personaId, defaultTipo, trigger, onAdded,
}: {
  personaId: string;
  defaultTipo: Tipo;
  trigger?: React.ReactNode;
  onAdded?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<Tipo>(defaultTipo);
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [sexo, setSexo] = useState<string>(
    defaultTipo === "padre" ? "masculino" : defaultTipo === "madre" ? "femenino" : "",
  );
  const [nacAprox, setNacAprox] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!nombres.trim() && !apellidos.trim()) {
      toast.error("Indica al menos nombre o apellido");
      return;
    }
    setBusy(true);
    try {
      const user = (await supabase.auth.getUser()).data.user!;
      const { data: nueva, error: e1 } = await supabase
        .from("personas")
        .insert({
          user_id: user.id,
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          sexo: sexo || null,
          nac_fecha_aprox: nacAprox || null,
          certeza: "probable",
        })
        .select()
        .single();
      if (e1) throw e1;

      // Insert main relation
      const { error: e2 } = await supabase.from("relaciones").insert({
        user_id: user.id,
        persona_id: personaId,
        pariente_id: nueva!.id,
        tipo: tipo as any,
      });
      if (e2) throw e2;

      // Inverse for clean tree traversal
      const inverse: Record<Tipo, Tipo | null> = {
        padre: "hijo", madre: "hijo", hijo: tipo === "hijo" ? "padre" : "madre", conyuge: "conyuge", hermano: "hermano",
      };
      const inv = tipo === "hijo" ? (sexo === "femenino" ? "madre" : "padre") : inverse[tipo];
      if (inv) {
        await supabase.from("relaciones").insert({
          user_id: user.id,
          persona_id: nueva!.id,
          pariente_id: personaId,
          tipo: inv as any,
        });
      }

      toast.success(`${labels[tipo]} agregado/a`);
      setOpen(false);
      setNombres(""); setApellidos(""); setNacAprox("");
      onAdded?.();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo agregar");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <UserPlus className="h-4 w-4" /> Agregar familiar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Agregar {labels[tipo]}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Tipo de relación</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="padre">Padre</SelectItem>
                <SelectItem value="madre">Madre</SelectItem>
                <SelectItem value="conyuge">Cónyuge</SelectItem>
                <SelectItem value="hijo">Hijo/a</SelectItem>
                <SelectItem value="hermano">Hermano/a</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Nombres</Label><Input value={nombres} onChange={(e) => setNombres(e.target.value)} autoFocus /></div>
            <div><Label>Apellidos</Label><Input value={apellidos} onChange={(e) => setApellidos(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Sexo</Label>
              <Select value={sexo} onValueChange={setSexo}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="femenino">Femenino</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nacimiento aprox.</Label><Input placeholder="hacia 1880" value={nacAprox} onChange={(e) => setNacAprox(e.target.value)} /></div>
          </div>
          <Button onClick={submit} disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
