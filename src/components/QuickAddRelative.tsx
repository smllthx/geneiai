import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, Search } from "lucide-react";
import { personaCode, matchesCode } from "@/lib/personaCode";

type Tipo = "padre" | "madre" | "conyuge" | "hijo" | "hermano";

const labels: Record<Tipo, string> = {
  padre: "padre", madre: "madre", conyuge: "cónyuge", hijo: "hijo/a", hermano: "hermano/a",
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
  const [query, setQuery] = useState("");
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
    supabase.from("personas").select("id, nombres, apellidos, sexo, nac_fecha, nac_rango_ini").then(({ data }) => setAll(data ?? []));
  }, [open]);

  // Mantener el sexo coherente con el tipo elegido (padre→masculino, madre→femenino)
  // solo cuando se está CREANDO una persona nueva (no cuando se eligió una existente).
  useEffect(() => {
    if (picked) return;
    if (tipo === "padre") setSexo("masculino");
    else if (tipo === "madre") setSexo("femenino");
  }, [tipo, picked]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return all
      .filter((x) => x.id !== personaId)
      .filter((x) => {
        const name = `${x.nombres ?? ""} ${x.apellidos ?? ""}`.toLowerCase();
        return name.includes(q) || matchesCode(query, x.id);
      })
      .slice(0, 8);
  }, [all, query, personaId]);

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
      case "hermano": return "hermano";
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const user = (await supabase.auth.getUser()).data.user!;
      let parienteId: string | null = null;

      if (mode === "buscar" && picked) {
        parienteId = picked.id;
      } else {
        if (!nombres.trim() && !apellidos.trim()) {
          toast.error("Indica al menos nombre o apellido"); setBusy(false); return;
        }
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
        parienteId = nueva!.id;
      }

      if (!parienteId) { toast.error("Selecciona o crea una persona"); setBusy(false); return; }
      if (parienteId === personaId) { toast.error("No puedes vincular a la misma persona"); setBusy(false); return; }

      // Guard: evitar relaciones contradictorias entre las mismas dos personas
      // (p.ej. ya son padre/madre/hijo y se intenta agregar como cónyuge, o viceversa).
      const { data: existentes } = await supabase
        .from("relaciones").select("tipo")
        .or(`and(persona_id.eq.${personaId},pariente_id.eq.${parienteId}),and(persona_id.eq.${parienteId},pariente_id.eq.${personaId})`);
      const tipos = new Set((existentes ?? []).map((r: any) => r.tipo));
      const esFamiliar = (t: string) => ["padre", "madre", "hijo"].includes(t);
      const incompatibles =
        (tipo === "conyuge" && [...tipos].some(esFamiliar)) ||
        (esFamiliar(tipo) && tipos.has("conyuge"));
      if (incompatibles) {
        toast.error("Esta persona ya tiene una relación incompatible (padre/madre/hijo o cónyuge). Edita la relación existente primero.");
        setBusy(false); return;
      }

      // Crea/asegura ambos sentidos de la relación con UPSERT para tolerar
      // re-vinculaciones y evitar que falle silenciosamente si ya existe una
      // fila idéntica. Sin esto, cuando el hijo ya tenía un padre creado, el
      // segundo lado podía quedar sin insertar y la persona "no se afiliaba".
      const inv = inverseFor(tipo, personaSexo);
      const rows = [
        { user_id: user.id, persona_id: personaId, pariente_id: parienteId, tipo: tipo as any, naturaleza: "biologica" as const, certeza: "probable" as const },
        { user_id: user.id, persona_id: parienteId, pariente_id: personaId, tipo: inv as any, naturaleza: "biologica" as const, certeza: "probable" as const },
      ];
      const { error: eUp } = await supabase
        .from("relaciones")
        .upsert(rows, { onConflict: "user_id,persona_id,pariente_id,tipo", ignoreDuplicates: true });
      if (eUp) throw eUp;

      // === Propagación automática de padres al agregar hermano/a ===
      if (tipo === "hermano") {
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
          if (!ya) await supabase.from("relaciones").insert({
            user_id: user.id, persona_id: hijoId, pariente_id: padreId, tipo: tipoPadre as any,
          });
          const { data: ya2 } = await supabase.from("relaciones").select("id")
            .eq("persona_id", padreId).eq("pariente_id", hijoId).eq("tipo", "hijo" as any).maybeSingle();
          if (!ya2) await supabase.from("relaciones").insert({
            user_id: user.id, persona_id: padreId, pariente_id: hijoId, tipo: "hijo" as any,
          });
        };
        for (const t of ["padre", "madre"] as const) {
          const a = mapA.get(t), b = mapB.get(t);
          if (a && !b) await upsert(parienteId, a, t);
          if (b && !a) await upsert(personaId, b, t);
        }
      }

      toast.success(`${labels[tipo]} ${mode === "buscar" ? "vinculado/a" : "agregado/a"}`);
      setOpen(false);
      setNombres(""); setApellidos(""); setNacAprox(""); setQuery(""); setPicked(null);
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
                <SelectItem value="hijo">Hijo/a</SelectItem>
                <SelectItem value="hermano">Hermano/a</SelectItem>
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
              <Label>Buscar por nombre o código (ej. GDVB-TS5)</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => { setQuery(e.target.value); setPicked(null); }}
                  placeholder="Escribe al menos 2 letras…" className="pl-7" autoFocus />
              </div>
              {picked ? (
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-2 text-sm">
                  <div className="font-medium">{picked.nombres} {picked.apellidos}</div>
                  <div className="text-xs text-muted-foreground">{personaCode(picked.id)}</div>
                </div>
              ) : matches.length > 0 ? (
                <ul className="max-h-56 overflow-auto rounded-lg border bg-popover text-sm">
                  {matches.map((m) => (
                    <li key={m.id}>
                      <button type="button" onClick={() => setPicked(m)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-accent">
                        <span className="truncate">{m.nombres} {m.apellidos}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{personaCode(m.id)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : query.length >= 2 ? (
                <p className="text-xs text-muted-foreground">Sin coincidencias. Cambia a "Crear nueva".</p>
              ) : null}
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
