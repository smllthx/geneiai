import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Sparkles, Loader2, FileText, Check, GitBranchPlus } from "lucide-react";
import { toast } from "sonner";
import PersonSearchSelect from "@/components/PersonSearchSelect";
import { fetchAllPeople, getActiveTreeId, withTreeScope } from "@/lib/peopleData";
import { inferSexFromName } from "@/lib/personAutoRules";

type Doc = {
  id: string;
  titulo: string;
  tipo: string;
  fecha: string | null;
  cita: string | null;
  repositorio: string | null;
  transcripcion: string | null;
  ocr_texto: string | null;
  personas_mencionadas: string[] | null;
};

type RelationByDocument = "padre" | "madre" | "hijo" | "conyuge" | "hermano";

const relationLabels: Record<RelationByDocument, string> = {
  padre: "Padre de esta persona",
  madre: "Madre de esta persona",
  hijo: "Hijo/a de esta persona",
  conyuge: "Cónyuge / unión",
  hermano: "Hermano/a",
};

export default function VincularFuente({ personaId, personaNombre, onLinked }: { personaId: string; personaNombre: string; onLinked?: () => void }) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [currentPerson, setCurrentPerson] = useState<any | null>(null);
  const [filter, setFilter] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [linkedNow, setLinkedNow] = useState<Set<string>>(new Set());
  const [relationDocId, setRelationDocId] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);
  const [relationType, setRelationType] = useState<RelationByDocument>("padre");
  const [relationBusy, setRelationBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data }, allPeople, { data: current }] = await Promise.all([
        supabase
          .from("documentos")
          .select("id,titulo,tipo,fecha,cita,repositorio,transcripcion,ocr_texto,personas_mencionadas")
          .order("created_at", { ascending: false }),
        fetchAllPeople("id,nombres,apellidos,variantes_nombre,sexo,nac_fecha,nac_fecha_aprox,nac_rango_ini,nac_rango_fin,defuncion_fecha,nacionalidad"),
        supabase.from("personas").select("id,nombres,apellidos,sexo").eq("id", personaId).maybeSingle(),
      ]);
      setDocs((data as any) ?? []);
      setPeople(allPeople ?? []);
      setCurrentPerson(current ?? null);
      setLinkedNow(new Set((data ?? []).filter((d: any) => (d.personas_mencionadas ?? []).includes(personaId)).map((d: any) => d.id)));
    })();
  }, [open, personaId]);

  const vincular = async (doc: Doc) => {
    const arr = Array.from(new Set([...(doc.personas_mencionadas ?? []), personaId]));
    const { error } = await supabase.from("documentos").update({ personas_mencionadas: arr }).eq("id", doc.id);
    if (error) return toast.error(error.message);
    setLinkedNow((s) => new Set([...s, doc.id]));
    toast.success(`Vinculado a "${doc.titulo}"`);
    onLinked?.();
  };

  const relationRows = async (relativeId: string, tipo: RelationByDocument, doc: Doc, userId: string) => {
    const activeTreeId = await getActiveTreeId(userId);
    const note = `Relación respaldada por acta/fuente: ${doc.titulo}${doc.fecha ? ` (${doc.fecha})` : ""}`;
    if (tipo === "padre" || tipo === "madre") {
      return [
        withTreeScope({ user_id: userId, persona_id: personaId, pariente_id: relativeId, tipo: tipo as any, notas: note, naturaleza: "biologica" as const, certeza: "probable" as const }, activeTreeId),
        withTreeScope({ user_id: userId, persona_id: relativeId, pariente_id: personaId, tipo: "hijo" as any, notas: note, naturaleza: "biologica" as const, certeza: "probable" as const }, activeTreeId),
      ];
    }
    if (tipo === "hijo") {
      const currentSex = currentPerson?.sexo || inferSexFromName(currentPerson?.nombres);
      const parentType = currentSex === "femenino" ? "madre" : "padre";
      return [
        withTreeScope({ user_id: userId, persona_id: relativeId, pariente_id: personaId, tipo: parentType as any, notas: note, naturaleza: "biologica" as const, certeza: "probable" as const }, activeTreeId),
        withTreeScope({ user_id: userId, persona_id: personaId, pariente_id: relativeId, tipo: "hijo" as any, notas: note, naturaleza: "biologica" as const, certeza: "probable" as const }, activeTreeId),
      ];
    }
    return [
      withTreeScope({ user_id: userId, persona_id: personaId, pariente_id: relativeId, tipo: tipo as any, notas: note, naturaleza: "biologica" as const, certeza: "probable" as const }, activeTreeId),
      withTreeScope({ user_id: userId, persona_id: relativeId, pariente_id: personaId, tipo: tipo as any, notas: note, naturaleza: "biologica" as const, certeza: "probable" as const }, activeTreeId),
    ];
  };

  const vincularRelacionPorActa = async (doc: Doc) => {
    if (!selectedPerson) return toast.error("Selecciona una persona existente para crear la relación.");
    if (selectedPerson.id === personaId) return toast.error("No puedes relacionar la persona consigo misma.");
    setRelationBusy(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Sesión no encontrada");
      if (relationType === "padre") await supabase.from("personas").update({ sexo: "masculino" }).eq("id", selectedPerson.id).is("sexo", null);
      if (relationType === "madre") await supabase.from("personas").update({ sexo: "femenino" }).eq("id", selectedPerson.id).is("sexo", null);

      const rows = await relationRows(selectedPerson.id, relationType, doc, user.id);
      const { error } = await supabase
        .from("relaciones")
        .upsert(rows, { onConflict: "user_id,persona_id,pariente_id,tipo", ignoreDuplicates: true });
      if (error) throw error;

      const peopleInDoc = Array.from(new Set([...(doc.personas_mencionadas ?? []), personaId, selectedPerson.id]));
      const { error: docError } = await supabase.from("documentos").update({ personas_mencionadas: peopleInDoc }).eq("id", doc.id);
      if (docError) throw docError;

      setLinkedNow((s) => new Set([...s, doc.id]));
      setDocs((current) => current.map((item) => item.id === doc.id ? { ...item, personas_mencionadas: peopleInDoc } : item));
      setSelectedPerson(null);
      setRelationDocId(null);
      toast.success("Relación vinculada y respaldada por el acta");
      window.dispatchEvent(new CustomEvent("genaia:data-changed", { detail: { personId: personaId, relatedPersonId: selectedPerson.id, table: "relaciones" } }));
      onLinked?.();
    } catch (error: any) {
      toast.error(error.message ?? "No se pudo vincular la relación");
    } finally {
      setRelationBusy(false);
    }
  };

  const sugerirConIA = async () => {
    setAiBusy(true);
    const t = toast.loading("Analizando documentos con IA…");
    try {
      const { data: p } = await supabase.from("personas").select("*").eq("id", personaId).maybeSingle();
      if (!p) throw new Error("Persona no encontrada");
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const nombre = norm(`${p.nombres} ${p.apellidos}`);
      const apellidos = norm(p.apellidos ?? "");
      const matches = docs.filter((d) => {
        if (linkedNow.has(d.id)) return false;
        const haystack = norm([d.titulo, d.cita, d.repositorio, d.transcripcion, d.ocr_texto].filter(Boolean).join(" "));
        return haystack.includes(nombre) || haystack.includes(apellidos);
      });
      toast.dismiss(t);
      if (!matches.length) {
        toast.info("La IA no encontró coincidencias por nombre/apellido en los documentos.");
        return;
      }
      let count = 0;
      for (const d of matches) { await vincular(d); count++; }
      toast.success(`${count} documento(s) vinculados automáticamente.`);
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e.message ?? "Error con IA");
    } finally { setAiBusy(false); }
  };

  const filtered = docs.filter((d) => {
    if (!filter.trim()) return true;
    const f = filter.toLowerCase();
    return d.titulo.toLowerCase().includes(f) || (d.cita ?? "").toLowerCase().includes(f) || d.id.includes(f);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Link2 className="h-4 w-4" /> Vincular fuente</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular fuente a {personaNombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Buscar por título, cita o número de orden / ID" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <Button variant="secondary" disabled={aiBusy} onClick={sugerirConIA}>
              {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              IA
            </Button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {filtered.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Sin documentos. Sube uno en la sección Documentos.</p>}
            {filtered.map((d, idx) => {
              const linked = linkedNow.has(d.id);
              return (
                <div key={d.id} className="space-y-2">
                  <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-card px-3 py-2">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">#{idx + 1} · {d.titulo}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{[d.tipo, d.fecha, d.repositorio, d.cita].filter(Boolean).join(" · ") || d.id.slice(0, 8)}</div>
                    </div>
                    {linked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"><Check className="h-3 w-3" /> Vinculado</span>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => vincular(d)}>Vincular</Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRelationDocId((current) => current === d.id ? null : d.id);
                        setSelectedPerson(null);
                      }}
                      title="Crear relación respaldada por esta acta"
                    >
                      <GitBranchPlus className="h-4 w-4" />
                    </Button>
                  </div>
                  {relationDocId === d.id && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_180px]">
                        <div>
                          <Label>Persona mencionada en el acta</Label>
                          <PersonSearchSelect
                            people={people}
                            value={selectedPerson}
                            onChange={setSelectedPerson}
                            excludeId={personaId}
                            placeholder="Buscar por nombre, apellido o código"
                            limit={32}
                          />
                        </div>
                        <div>
                          <Label>Relación con {personaNombre}</Label>
                          <Select value={relationType} onValueChange={(value) => setRelationType(value as RelationByDocument)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(Object.keys(relationLabels) as RelationByDocument[]).map((key) => (
                                <SelectItem key={key} value={key}>{relationLabels[key]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button size="sm" disabled={relationBusy || !selectedPerson} onClick={() => vincularRelacionPorActa(d)}>
                        {relationBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranchPlus className="h-4 w-4" />}
                        Vincular relación por acta
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
