import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { FileDown, Network, FileText, ScrollText, PieChart, UserSquare2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { runExport, type ExportKind } from "@/lib/personaExports";
import { supabase } from "@/integrations/supabase/client";

const ITEMS: { kind: ExportKind; label: string; icon: any; desc: string }[] = [
  { kind: "cuadro", label: "PDF del Cuadro genealógico", icon: Network, desc: "Pedigrí horizontal en cascada" },
  { kind: "familia", label: "Familia en PDF", icon: FileText, desc: "Informe familiar completo" },
  { kind: "familia-fuentes", label: "Familia con fuentes en PDF", icon: ScrollText, desc: "Informe con citas y referencias" },
  { kind: "abanico", label: "PDF Cuadro estilo abanico", icon: PieChart, desc: "Abanico ascendente radial" },
  { kind: "retrato", label: "PDF del Cuadro estilo retrato", icon: UserSquare2, desc: "Vertical, formal, retrato" },
];

export default function PersonaExports({ personaId, personaNombre }: { personaId: string; personaNombre: string }) {
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const handle = async (kind: ExportKind) => {
    setBusy(kind);
    const t = toast.loading("Generando PDF…");
    try {
      await runExport(kind, personaId);
      toast.dismiss(t);
      toast.success("PDF descargado");
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e.message ?? "Error al generar PDF");
    } finally {
      setBusy(null);
    }
  };

  const aiBiografia = async () => {
    setAiBusy(true);
    const t = toast.loading("Generando contenido con IA para los PDFs…");
    try {
      await supabase.functions.invoke("biografia-auto", { body: { person_id: personaId } });
      toast.dismiss(t);
      toast.success("Contenido enriquecido. Ya puedes generar el PDF.");
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e.message ?? "Error con IA");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <FileDown className="h-4 w-4" /> PDFs
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[92vw] max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">Exportar a PDF</SheetTitle>
          <SheetDescription>Genera documentos genealógicos de <strong>{personaNombre}</strong>.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 mb-3">
          <Button size="sm" variant="secondary" className="w-full" disabled={aiBusy} onClick={aiBiografia}>
            {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Enriquecer con IA antes de exportar
          </Button>
          <p className="mt-1 text-[11px] text-muted-foreground">Genera biografía y completa datos. Luego usa cualquier botón.</p>
        </div>

        <div className="grid gap-2">
          {ITEMS.map(({ kind, label, icon: Icon, desc }) => (
            <button
              key={kind}
              onClick={() => handle(kind)}
              disabled={busy !== null}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-left transition hover:bg-foreground/5 disabled:opacity-60"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                {busy === kind ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{label}</div>
                <div className="text-[11px] text-muted-foreground">{desc}</div>
              </div>
              <FileDown className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
