import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { inferSexFromName } from "@/lib/personAutoRules";
import { fetchAllPeople, getActiveTreeId, withTreeScope } from "@/lib/peopleData";
import PersonSearchSelect from "@/components/PersonSearchSelect";

type Tipo =
  | "padre" | "madre" | "conyuge" | "hijo" | "hermano"
  | "union_civil" | "conviviente" | "cohabitante"
  | "padrino" | "madrina" | "ahijado" | "primo" | "prima"
  | "socio_negocio" | "testigo" | "otro";

const labels: Record<Tipo, string> = {
  padre: "padre", madre: "madre", conyuge: "cónyuge", hijo: "hijo/a", hermano: "hermano/a",
  union_civil: "unión civil", conviviente: "conviviente", cohabitante: "cohabitante",
  padrino: "padrino", madrina: "madrina", ahijado: "ahijado/a", primo: "primo", prima: "prima",
  socio_negocio: "socio/a de negocio", testigo: "testigo", otro: "otra relación",
};

const dbTipoFor = (t: Tipo) =>
  (["union_civil", "conviviente", "cohabitante"].includes(t)
    ? "conyuge"
    : ["padre", "madre", "conyuge", "hijo", "hermano"].includes(t) ? t : "otro") as "padre" | "madre" | "conyuge" | "hijo" | "hermano" | "otro";

const relationNoteFor = (t: Tipo) => {
  const dbTipo = dbTipoFor(t);
  if (dbTipo === "otro") return `relación genealógica: ${labels[t]}`;
  if (dbTipo === "conyuge" && t !== "conyuge") return `tipo de unión: ${labels[t]}`;
  return null;
};

export default function QuickAddRelative({
  personaId, personaSexo, defaultTipo, trigger, onAdded,
}: {
  personaId: string;
  personaSexo?: string | null;
  defaultTipo: Tipo;
  trigger?: React.ReactNode;
  onAdded?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<Tipo>(defaultTipo);
  const [mode, setMode] = useState<"buscar" | "crear">("buscar");
  const [picked, setPicked] = useState<any | null>(null);
  const [all, setAll] = useState<any[]>([]);

  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [sexo, setSexo] = useState<string>(
    defaultTipo === "padre" ? "masculino" : defaultTipo === "madre" ? "femenino" : "",
  );
  const [nacAprox, setNacAprox] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchAllPeople("id, nombres, apellidos, variantes_nombre, sexo, nac_fecha, nac_fecha_aprox, nac_rango_ini, nac_rango_fin, defuncion_fecha")
      .then(setAll)
      .catch((e) => toast.error(e.message ?? "No se pudieron cargar todas las personas"));
  }, [open]);

  // Mantener el sexo coherente con el tipo elegido (padre→masculino, madre→femenino)
  // solo cuando se está CREANDO una persona nueva (no cuando se eligió una existente).
  useEffect(() => {
    if (picked) return;
    if (tipo === "padre") setSexo("masculino");
    else if (tipo === "madre") setSexo("femenino");
  }, [tipo, picked]);

  // Cuando se elige una persona existente, autollenamos los campos de crear (por si el usuario cambia de modo)
  useEffect(() => {
    if (picked) {
      setNombres(picked.nombres ?? "");
      setApellidos(picked.apellidos ?? "");
      setSexo(picked.sexo ?? "");
    }
  }, [picked]);

  // El inverso debe basarse en el SEXO DE LA PERSONA ACTUAL, no del nuevo pariente
  const inverseFor = (t: Tipo, currentSex?: string | null): Tipo => {
    switch (t) {
      case "padre": return "hijo";
      case "madre": return "hijo";
      case "hijo":  return currentSex === "femenino" ? "madre" : "padre";
      case "conyuge": return "conyuge";
      case "union_civil": return "union_civil";
      case "conviviente": return "conviviente";
      case "cohabitante": return "cohabitante";
      case "padrino": return "ahijado";
      case "madrina": return "ahijado";
      case "ahijado": return "padrino";
      case "primo": return "primo";
      case "prima": return "prima";
      case "socio_negocio": return "socio_negocio";
      case "testigo": return "testigo";
      case "hermano": return "hermano";
      case "otro": return "otro";
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const user = (await supabase.auth.getUser()).data.user!;
      const activeTreeId = await getActiveTreeId(user.id);
      let parienteId: string | null = null;

      if (mode === "buscar" && picked) {
        parienteId = picked.id;
      } else {
        if (!nombres.trim() && !apellidos.trim()) {
          toast.error("Indica al menos nombre o apellido"); setBusy(false); return;
        }
        const { data: nueva, error: e1 } = await supabase
          .from("personas")
          .insert(withTreeScope({
            user_id: user.id,
            nombres: nombres.trim(),
            apellidos: apellidos.trim(),
            sexo: sexo || inferSexFromName(nombres) || null,
            nac_fecha_aprox: nacAprox || null,
            certeza: "probable",
          }, activeTreeId))
          .select()
          .single();
        if (e1) throw e1;
        parienteId = nueva!.id;
      }

      if (!parienteId) { toast.error("Selecciona o crea una persona"); setBusy(false); return; }
      if (parienteId === personaId) { toast.error("No puedes vincular a la misma persona"); setBusy(false); return; }

      const dbTipo = dbTipoFor(tipo);
      const pickedSex = picked?.sexo || inferSexFromName(picked?.nombres);
      if (mode === "buscar" && picked && !picked.sexo && pickedSex) {
        await supabase.from("personas").update({ sexo: pickedSex }).eq("id", picked.id).is("sexo", null);
      }
      if (dbTipo === "padre") await supabase.from("personas").update({ sexo: "masculino" }).eq("id", parienteId).is("sexo", null);
      if (dbTipo === "madre") await supabase.from("personas").update({ sexo: "femenino" }).eq("id", parienteId).is("sexo", null);

      // Crea/asegura ambos sentidos de la relación con UPSERT para tolerar
      // re-vinculaciones y evitar que falle silenciosamente si ya existe una
      // fila idéntica. Sin esto, cuando el hijo ya tenía un padre creado, el
      // segundo lado podía quedar sin insertar y la persona "no se afiliaba".
      const inv = inverseFor(tipo, personaSexo);
      const invDbTipo = dbTipoFor(inv);
      const rows = [
        withTreeScope({ user_id: user.id, persona_id: personaId, pariente_id: parienteId, tipo: dbTipo as any, notas: relationNoteFor(tipo), naturaleza: "biologica" as const, certeza: "probable" as const }, activeTreeId),
        withTreeScope({ user_id: user.id, persona_id: parienteId, pariente_id: personaId, tipo: invDbTipo as any, notas: relationNoteFor(inv), naturaleza: "biologica" as const, certeza: "probable" as const }, activeTreeId),
      ];
      const { error: eUp } = await supabase
        .from("relaciones")
        .upsert(rows, { onConflict: "user_id,persona_id,pariente_id,tipo", ignoreDuplicates: true });
      if (eUp) throw eUp;

      // Si se agrega un hijo/a desde una persona que ya tiene cónyuge, unión civil
      // o conviviente, el niño debe quedar conectado a ambos lados. Esto mantiene
      // sincronizadas las fichas de cónyuges, padres, hermanos y árbol.
      if (dbTipo === "hijo") {
        const { data: partners } = await supabase
          .from("relaciones")
          .select("pariente_id, pariente:personas!relaciones_pariente_id_fkey(id,sexo)")
          .eq("user_id", user.id)
          .eq("persona_id", personaId)
          .eq("tipo", "conyuge" as any);

        const parentRows = (partners ?? [])
          .filter((r: any) => r.pariente_id && r.pariente_id !== parienteId)
          .flatMap((r: any) => {
            const parentType = r.pariente?.sexo === "femenino" ? "madre" : "padre";
            return [
              withTreeScope({ user_id: user.id, persona_id: parienteId, pariente_id: r.pariente_id, tipo: parentType as any, notas: "vinculado por cónyuge/unión al agregar hijo", naturaleza: "biologica" as const, certeza: "probable" as const }, activeTreeId),
              withTreeScope({ user_id: user.id, persona_id: r.pariente_id, pariente_id: parienteId, tipo: "hijo" as any, notas: "vinculado por cónyuge/unión al agregar hijo", naturaleza: "biologica" as const, certeza: "probable" as const }, activeTreeId),
            ];
          });
        if (parentRows.length > 0) {
          const { error: eParents } = await supabase
            .from("relaciones")
            .upsert(parentRows, { onConflict: "user_id,persona_id,pariente_id,tipo", ignoreDuplicates: true });
          if (eParents) throw eParents;
        }
      }

      // Si se agrega un padre o madre y ya existe el otro progenitor, conecta a
      // ambos como pareja/parentalidad para que los hermanos y fichas familiares
      // se reconstruyan desde cualquier vista.
      if (dbTipo === "padre" || dbTipo === "madre") {
        const otherType = dbTipo === "padre" ? "madre" : "padre";
        const { data: otherParent } = await supabase
          .from("relaciones")
          .select("pariente_id")
          .eq("user_id", user.id)
          .eq("persona_id", personaId)
          .eq("tipo", otherType as any)
          .maybeSingle();
        if (otherParent?.pariente_id && otherParent.pariente_id !== parienteId) {
          const spouseRows = [
            withTreeScope({ user_id: user.id, persona_id: parienteId, pariente_id: otherParent.pariente_id, tipo: "conyuge" as any, notas: "parentalidad compartida", naturaleza: "biologica" as const, certeza: "probable" as const }, activeTreeId),
            withTreeScope({ user_id: user.id, persona_id: otherParent.pariente_id, pariente_id: parienteId, tipo: "conyuge" as any, notas: "parentalidad compartida", naturaleza: "biologica" as const, certeza: "probable" as const }, activeTreeId),
          ];
          const { error: eSpouse } = await supabase
            .from("relaciones")
            .upsert(spouseRows, { onConflict: "user_id,persona_id,pariente_id,tipo", ignoreDuplicates: true });
          if (eSpouse) throw eSpouse;
        }
      }

      // === Propagación automática de padres al agregar hermano/a ===
      if (dbTipo === "hermano") {
        const [{ data: padresA }, { data: padresB }] = await Promise.all([
          supabase.from("relaciones").select("pariente_id, tipo")
            .eq("user_id", user.id).eq("persona_id", personaId).in("tipo", ["padre", "madre"] as any),
          supabase.from("relaciones").select("pariente_id, tipo")
            .eq("user_id", user.id).eq("persona_id", parienteId).in("tipo", ["padre", "madre"] as any),
        ]);
        const mapA = new Map((padresA ?? []).map((r: any) => [r.tipo, r.pariente_id as string]));
        const mapB = new Map((padresB ?? []).map((r: any) => [r.tipo, r.pariente_id as string]));
        const upsert = async (hijoId: string, padreId: string, tipoPadre: "padre" | "madre") => {
          const { data: ya } = await supabase.from("relaciones").select("id")
            .eq("persona_id", hijoId).eq("pariente_id", padreId).eq("tipo", tipoPadre as any).maybeSingle();
          if (!ya) await supabase.from("relaciones").insert(withTreeScope({
            user_id: user.id, persona_id: hijoId, pariente_id: padreId, tipo: tipoPadre as any,
          }, activeTreeId));
          const { data: ya2 } = await supabase.from("relaciones").select("id")
            .eq("persona_id", padreId).eq("pariente_id", hijoId).eq("tipo", "hijo" as any).maybeSingle();
          if (!ya2) await supabase.from("relaciones").insert(withTreeScope({
            user_id: user.id, persona_id: padreId, pariente_id: hijoId, tipo: "hijo" as any,
          }, activeTreeId));
        };
        for (const t of ["padre", "madre"] as const) {
          const a = mapA.get(t), b = mapB.get(t);
          if (a && !b) await upsert(parienteId, a, t);
          if (b && !a) await upsert(personaId, b, t);
        }
      }

      toast.success(`${labels[tipo]} ${mode === "buscar" ? "vinculado/a" : "agregado/a"}`);
      setOpen(false);
      setNombres(""); setApellidos(""); setNacAprox(""); setPicked(null);
      window.dispatchEvent(new CustomEvent("genaia:data-changed", { detail: { personId: personaId, relatedPersonId: parienteId, table: "relaciones" } }));
      onAdded?.();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo agregar");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (<Button size="sm" variant="outline"><UserPlus className="h-4 w-4" /> Agregar familiar</Button>)}
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
                <SelectItem value="union_civil">Unión civil</SelectItem>
                <SelectItem value="conviviente">Conviviente</SelectItem>
                <SelectItem value="cohabitante">Cohabitante</SelectItem>
                <SelectItem value="hijo">Hijo/a</SelectItem>
                <SelectItem value="hermano">Hermano/a</SelectItem>
                <SelectItem value="primo">Primo</SelectItem>
                <SelectItem value="prima">Prima</SelectItem>
                <SelectItem value="padrino">Padrino</SelectItem>
                <SelectItem value="madrina">Madrina</SelectItem>
                <SelectItem value="ahijado">Ahijado/a</SelectItem>
                <SelectItem value="socio_negocio">Socio/a de negocio</SelectItem>
                <SelectItem value="testigo">Testigo</SelectItem>
                <SelectItem value="otro">Otra relación</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-1 rounded-lg bg-muted p-1 text-xs">
            <button type="button" onClick={() => { setMode("buscar"); setPicked(null); }}
              className={`flex-1 rounded-md px-2 py-1.5 ${mode === "buscar" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>
              Buscar existente
            </button>
            <button type="button" onClick={() => setMode("crear")}
              className={`flex-1 rounded-md px-2 py-1.5 ${mode === "crear" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>
              Crear nueva
            </button>
          </div>

          {mode === "buscar" ? (
            <div className="grid gap-2">
              <Label>Buscar persona existente en todo el índice</Label>
              <PersonSearchSelect
                people={all}
                value={picked}
                onChange={setPicked}
                excludeId={personaId}
                limit={120}
                placeholder="Buscar por apellido, nombre, código o fecha"
                emptyText="Sin coincidencias. Cambia a Crear nueva si la persona no existe."
              />
            </div>
          ) : (
            <>
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
            </>
          )}

          <Button onClick={submit} disabled={busy || (mode === "buscar" && !picked)}>
            {busy ? "Guardando…" : mode === "buscar" ? "Vincular" : "Crear y vincular"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
