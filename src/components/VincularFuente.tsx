import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Link2, Sparkles, Loader2, FileText, Check } from "lucide-react";
import { toast } from "sonner";

type Doc = { id: string; titulo: string; tipo: string; fecha: string | null; cita: string | null; repositorio: string | null; personas_mencionadas: string[] | null };

export default function VincularFuente({ personaId, personaNombre, onLinked }: { personaId: string; personaNombre: string; onLinked?: () => void }) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [filter, setFilter] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [linkedNow, setLinkedNow] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from("documentos").select("id,titulo,tipo,fecha,cita,repositorio,personas_mencionadas").order("created_at", { ascending: false });
      setDocs((data as any) ?? []);
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

  const sugerirConIA = async () => {
    setAiBusy(true);
    const t = toast.loading("Analizando documentos con IA…");
    try {
      const { data: p } = await supabase.from("personas").select("*").eq("id", personaId).maybeSingle();
      if (!p) throw new Error("Persona no encontrada");
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const nombre = norm(`${p.nombres} ${p.apellidos}`);
      const apellidos = norm(p.apellidos);
      const matches = docs.filter((d) => {
        if (linkedNow.has(d.id)) return false;
        const haystack = norm([d.titulo, d.cita, d.repositorio].filter(Boolean).join(" "));
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
                <div key={d.id} className="flex items-start gap-2 rounded-xl border border-border/60 bg-card px-3 py-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">#{idx + 1} · {d.titulo}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{[d.tipo, d.fecha, d.repositorio, d.cita].filter(Boolean).join(" · ") || d.id.slice(0, 8)}</div>
                  </div>
                  {linked ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"><Check className="h-3 w-3" /> Vinculado</span>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => vincular(d)}>Vincular</Button>
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
