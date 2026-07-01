import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import LugarSelect, { useLugares } from "@/components/LugarSelect";
import PersonSearchSelect from "@/components/PersonSearchSelect";

type EventoTipo =
  | "nacimiento" | "bautismo" | "matrimonio" | "defuncion" | "entierro"
  | "residencia" | "censo" | "inmigracion" | "viaje" | "ocupacion" | "otro";

const TIPOS: { value: EventoTipo; label: string; icon: string }[] = [
  { value: "nacimiento", label: "Nacimiento", icon: "○" },
  { value: "bautismo", label: "Bautismo / rito", icon: "✚" },
  { value: "matrimonio", label: "Matrimonio / unión", icon: "∞" },
  { value: "residencia", label: "Residencia", icon: "⌂" },
  { value: "ocupacion", label: "Ocupación", icon: "⚒" },
  { value: "censo", label: "Censo / padrón", icon: "▦" },
  { value: "inmigracion", label: "Inmigración", icon: "⇢" },
  { value: "viaje", label: "Viaje / traslado", icon: "↝" },
  { value: "defuncion", label: "Defunción", icon: "✝" },
  { value: "entierro", label: "Entierro", icon: "▱" },
  { value: "otro", label: "Otro hecho", icon: "•" },
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
  const [personas, setPersonas] = useState<any[]>([]);
  const [taggedIds, setTaggedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [lugares, setLugares] = useLugares();

  useEffect(() => {
    if (!open) return;
    supabase
      .from("personas")
      .select("id,nombres,apellidos,sexo,nac_fecha,nac_fecha_aprox,nac_rango_ini,nac_rango_fin,defuncion_fecha,defuncion_fecha_aprox,variantes_nombre,notas")
      .order("apellidos", { ascending: true })
      .limit(2000)
      .then(({ data }) => setPersonas(data ?? []));
  }, [open]);

  const taggedPeople = useMemo(
    () => taggedIds.map((pid) => personas.find((p) => p.id === pid)).filter(Boolean),
    [taggedIds, personas],
  );

  const reset = () => {
    setStep("tipo"); setTipo("residencia"); setFecha(""); setFechaAprox("");
    setLugarId(null); setDescripcion(""); setCerteza("probable"); setTaggedIds([]);
  };

  const pick = (t: EventoTipo) => { setTipo(t); setStep("datos"); };

  const save = async () => {
    setBusy(true);
    try {
      const user = (await supabase.auth.getUser()).data.user!;
      const grupo = taggedIds.length ? crypto.randomUUID() : null;
      const selectedNames = taggedPeople.map((p: any) => `${p.nombres ?? ""} ${p.apellidos ?? ""}`.trim()).filter(Boolean);
      const detalleCompartido = grupo
        ? [
            descripcion || null,
            `Evento compartido con: ${selectedNames.join(", ") || `${taggedIds.length} persona(s)`}.`,
            `Grupo de evento GENEAI: ${grupo}`,
          ].filter(Boolean).join("\n")
        : (descripcion || null);
      const rows = [personaId, ...taggedIds].map((pid) => ({
        user_id: user.id,
        persona_id: pid,
        tipo: tipo as any,
        fecha: fecha || null,
        fecha_aprox: fechaAprox || null,
        lugar_id: lugarId,
        descripcion: detalleCompartido,
        certeza: certeza as any,
      }));
      const { error } = await supabase.from("eventos").insert(rows);
      if (error) throw error;
      window.dispatchEvent(new CustomEvent("genaia:data-changed", { detail: { table: "eventos", source: "local" } }));
      toast.success(taggedIds.length ? `Hecho agregado a ${rows.length} personas` : "Información agregada");
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
                className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card/40 p-3 text-left transition hover:border-primary hover:bg-accent/20">
                <span className="genealogy-symbol h-8 w-8 text-sm">{t.icon}</span>
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
                placeholder={tipo === "inmigracion" ? "Ej. Inmigración a América / Chile el 31 de marzo de 1905 en el mismo barco." : tipo === "ocupacion" ? "Ej. Carpintero en taller del puerto" : tipo === "residencia" ? "Ej. Vivió en casa familiar de la calle Mayor" : "Detalles del hecho…"} />
            </div>
            <div className="rounded-2xl border border-border bg-card/40 p-3">
              <Label>Personas vinculadas al mismo hecho</Label>
              <p className="mb-2 mt-1 text-xs text-muted-foreground">
                Útil para inmigraciones, viajes, censos, matrimonios, barcos, grupos familiares o eventos compartidos.
              </p>
              {taggedPeople.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {taggedPeople.map((p: any) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setTaggedIds((ids) => ids.filter((x) => x !== p.id))}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary"
                    >
                      {p.nombres} {p.apellidos} <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}
              <PersonSearchSelect
                people={personas.filter((p) => !taggedIds.includes(p.id))}
                value={null}
                onChange={(person) => {
                  if (!person || person.id === personaId) return;
                  setTaggedIds((ids) => ids.includes(person.id) ? ids : [...ids, person.id]);
                }}
                excludeId={personaId}
                limit={80}
                placeholder="Buscar persona por apellido, nombre, código o fecha"
                emptyText="No encontré personas para vincular al hecho."
              />
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
