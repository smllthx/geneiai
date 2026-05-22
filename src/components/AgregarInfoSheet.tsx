import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import LugarSelect, { useLugares } from "@/components/LugarSelect";

type EventoTipo =
  | "nacimiento" | "bautismo" | "matrimonio" | "defuncion" | "entierro"
  | "residencia" | "censo" | "inmigracion" | "viaje" | "ocupacion" | "otro";

const TIPOS: { value: EventoTipo; label: string; icon: string }[] = [
  { value: "nacimiento", label: "Nacimiento", icon: "👶" },
  { value: "bautismo", label: "Bautismo", icon: "💧" },
  { value: "matrimonio", label: "Matrimonio", icon: "💍" },
  { value: "residencia", label: "Residencia", icon: "🏠" },
  { value: "ocupacion", label: "Ocupación", icon: "💼" },
  { value: "censo", label: "Censo", icon: "📋" },
  { value: "inmigracion", label: "Inmigración", icon: "🚢" },
  { value: "viaje", label: "Viaje", icon: "✈️" },
  { value: "defuncion", label: "Defunción", icon: "🕊️" },
  { value: "entierro", label: "Entierro", icon: "⚱️" },
  { value: "otro", label: "Otro", icon: "📌" },
];

export default function AgregarInfoSheet({ personaId, onAdded, trigger }: {
  personaId: string; onAdded?: () => void; trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"tipo" | "datos">("tipo");
  const [tipo, setTipo] = useState<EventoTipo>("residencia");
  const [fecha, setFecha] = useState("");
  const [fechaAprox, setFechaAprox] = useState("");
  const [lugarId, setLugarId] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [certeza, setCerteza] = useState<string>("probable");
  const [busy, setBusy] = useState(false);
  const [lugares, setLugares] = useLugares();

  const reset = () => {
    setStep("tipo"); setTipo("residencia"); setFecha(""); setFechaAprox("");
    setLugarId(null); setDescripcion(""); setCerteza("probable");
  };

  const pick = (t: EventoTipo) => { setTipo(t); setStep("datos"); };

  const save = async () => {
    setBusy(true);
    try {
      const user = (await supabase.auth.getUser()).data.user!;
      const { error } = await supabase.from("eventos").insert({
        user_id: user.id,
        persona_id: personaId,
        tipo: tipo as any,
        fecha: fecha || null,
        fecha_aprox: fechaAprox || null,
        lugar_id: lugarId,
        descripcion: descripcion || null,
        certeza: certeza as any,
      });
      if (error) throw error;
      toast.success("Información agregada");
      setOpen(false); reset(); onAdded?.();
    } catch (e: any) { toast.error(e.message ?? "Error"); }
    finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <SheetTrigger asChild>
        {trigger ?? (<Button size="sm" variant="outline"><Plus className="h-4 w-4" /> Agregar información</Button>)}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{step === "tipo" ? "¿Qué deseas agregar?" : `Agregar ${TIPOS.find((t) => t.value === tipo)?.label.toLowerCase()}`}</SheetTitle>
        </SheetHeader>

        {step === "tipo" ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {TIPOS.map((t) => (
              <button key={t.value} onClick={() => pick(t.value)}
                className="flex flex-col items-start gap-1 rounded-xl border border-border bg-card/40 p-3 text-left hover:border-primary hover:bg-accent/40 transition">
                <span className="text-xl">{t.icon}</span>
                <span className="text-sm font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Fecha</Label>
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div>
                <Label>Fecha aprox.</Label>
                <Input placeholder="hacia 1900" value={fechaAprox} onChange={(e) => setFechaAprox(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Lugar</Label>
              <LugarSelect value={lugarId} onChange={setLugarId} lugares={lugares} onLugaresChange={setLugares} />
            </div>
            <div>
              <Label>Detalle</Label>
              <Textarea rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
                placeholder={tipo === "ocupacion" ? "Ej. Carpintero en taller del puerto" : tipo === "residencia" ? "Ej. Vivió en casa familiar de la calle Mayor" : "Detalles del hecho…"} />
            </div>
            <div>
              <Label>Certeza</Label>
              <Select value={certeza} onValueChange={setCerteza}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comprobado">Comprobado</SelectItem>
                  <SelectItem value="probable">Probable</SelectItem>
                  <SelectItem value="hipotesis">Hipótesis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("tipo")}>Atrás</Button>
              <Button className="flex-1" onClick={save} disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
