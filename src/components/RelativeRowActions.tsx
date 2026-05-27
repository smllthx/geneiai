// Acciones rápidas por familiar: cambiar tipo de relación o eliminarla.
// Se usa dentro de las listas de Padres / Hijos / Hermanos / Cónyuges en la ficha.
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";

type Tipo = "padre" | "madre" | "hijo" | "conyuge" | "hermano";

const LABELS: Record<Tipo, string> = {
  padre: "padre", madre: "madre", hijo: "hijo/a", conyuge: "cónyuge", hermano: "hermano/a",
};

async function getUserId() {
  return (await supabase.auth.getUser()).data.user?.id ?? null;
}

/** Borra todas las filas (ambos sentidos) entre dos personas. */
async function deleteBoth(userId: string, a: string, b: string) {
  const { error } = await supabase
    .from("relaciones")
    .delete()
    .eq("user_id", userId)
    .or(`and(persona_id.eq.${a},pariente_id.eq.${b}),and(persona_id.eq.${b},pariente_id.eq.${a})`);
  if (error) throw error;
}

/** Crea la relación + su inversa, con el sexo de cada lado para resolver padre/madre. */
async function createBoth(
  userId: string,
  personaId: string,
  parienteId: string,
  tipo: Tipo,
  personaSexo?: string | null,
  parienteSexo?: string | null,
) {
  const inverse: Tipo =
    tipo === "padre" || tipo === "madre"
      ? "hijo"
      : tipo === "hijo"
        ? personaSexo === "femenino" ? "madre" : "padre"
        : tipo;
  // Si el tipo es padre/madre, ajustar al sexo del pariente si difiere
  let mainTipo = tipo;
  if (tipo === "padre" && parienteSexo === "femenino") mainTipo = "madre";
  if (tipo === "madre" && parienteSexo === "masculino") mainTipo = "padre";

  const rows = [
    { user_id: userId, persona_id: personaId, pariente_id: parienteId, tipo: mainTipo as any },
    { user_id: userId, persona_id: parienteId, pariente_id: personaId, tipo: inverse as any },
  ];
  const { error } = await supabase
    .from("relaciones")
    .upsert(rows, { onConflict: "user_id,persona_id,pariente_id,tipo", ignoreDuplicates: true });
  if (error) throw error;
}

export default function RelativeRowActions({
  personaId, personaSexo, parienteId, parienteSexo, currentTipo, onChanged,
}: {
  personaId: string;
  personaSexo?: string | null;
  parienteId: string;
  parienteSexo?: string | null;
  /** Cómo es el pariente respecto a la persona actual (padre/madre/hijo/conyuge/hermano). */
  currentTipo: Tipo;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const eliminar = async () => {
    if (!confirm(`¿Quitar la relación con este ${LABELS[currentTipo]}?`)) return;
    setBusy(true);
    try {
      const uid = await getUserId();
      if (!uid) throw new Error("Sesión requerida");
      await deleteBoth(uid, personaId, parienteId);
      toast.success("Relación eliminada");
      setOpen(false);
      onChanged?.();
    } catch (e: any) { toast.error(e.message ?? "No se pudo eliminar"); }
    finally { setBusy(false); }
  };

  const cambiarA = async (nuevo: Tipo) => {
    setBusy(true);
    try {
      const uid = await getUserId();
      if (!uid) throw new Error("Sesión requerida");
      await deleteBoth(uid, personaId, parienteId);
      await createBoth(uid, personaId, parienteId, nuevo, personaSexo, parienteSexo);
      toast.success(`Cambiado a ${LABELS[nuevo]}`);
      setOpen(false);
      onChanged?.();
    } catch (e: any) { toast.error(e.message ?? "No se pudo cambiar"); }
    finally { setBusy(false); }
  };

  // Opciones a mostrar (siempre menos la actual)
  const opciones: Tipo[] = (["padre", "madre", "hijo", "conyuge", "hermano"] as Tipo[])
    .filter((t) => t !== currentTipo);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
          className="shrink-0 rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="Editar relación"
        >
          <Pencil className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-56 p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="px-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Cambiar a
        </p>
        <div className="grid gap-1">
          {opciones.map((t) => (
            <Button
              key={t}
              variant="ghost"
              size="sm"
              className="h-8 justify-start"
              disabled={busy}
              onClick={() => cambiarA(t)}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" /> {LABELS[t]}
            </Button>
          ))}
        </div>
        <div className="my-2 border-t border-border" />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={busy}
          onClick={eliminar}
        >
          <Trash2 className="h-3.5 w-3.5" /> Quitar relación
        </Button>
      </PopoverContent>
    </Popover>
  );
}
