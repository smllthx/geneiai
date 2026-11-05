import PersonPortrait from "@/components/PersonPortrait";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { generatePersonPoster, downloadPersonPoster } from "@/lib/personPoster";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Printer, Sparkles, UserRound } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { personaCode } from "@/lib/personaCode";

export default function CuadrosIA() {
  const [personas, setPersonas] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [poster, setPoster] = useState<{ id: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const portraitRef = useRef<HTMLDivElement>(null);
  const result = poster?.id === selected?.id ? poster?.url : undefined;
  const [searchParams] = useSearchParams();
  const personaParam = searchParams.get("persona");

  useEffect(() => {
    (async () => {
      const selectCols = "id,nombres,apellidos,nac_fecha,nac_fecha_aprox,defuncion_fecha,foto_url,ocupacion,lugar:lugares!personas_nac_lugar_id_fkey(ciudad,pais),nacionalidad";
      const { data } = await supabase.from("personas").select(selectCols).order("updated_at", { ascending: false }).limit(24);
      let rows = data ?? [];
      let initial = personaParam ? rows.find((p) => p.id === personaParam) : null;
      if (personaParam && !initial) {
        const { data: exact } = await supabase.from("personas").select(selectCols).eq("id", personaParam).maybeSingle();
        if (exact) {
          initial = exact;
          rows = [exact, ...rows.filter((p) => p.id !== exact.id)];
        }
      }
      setPersonas(rows);
      setSelected(initial ?? rows[0] ?? null);
    })();
  }, [personaParam]);

  const generate = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const portrait = portraitRef.current?.querySelector("img")?.currentSrc;
      const url = await generatePersonPoster({ ...selected, nac_lugar: [selected.lugar?.ciudad, selected.lugar?.pais].filter(Boolean).join(", ") }, portrait ?? selected.foto_url);
      setPoster({ id: selected.id, url });
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo generar el cuadro."); }
    finally { setBusy(false); }
  };
  const download = (format: "png" | "pdf") => {
    if (result) void downloadPersonPoster(result, selected.id, format).catch(() => toast.error("No se pudo exportar el cuadro."));
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cuadros IA"
        subtitle="Crea un cuadro con el retrato y los datos registrados de una persona."
      />

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader><CardTitle>Persona base</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {personas.length === 0 && (
              <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">
                No encontré personas para generar cuadros. Revisa que la ficha exista y que tengas acceso.
              </p>
            )}
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:bg-muted ${selected?.id === p.id ? "border-primary bg-primary/5" : ""}`}
              >
                <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-muted text-xs font-semibold">
                  <PersonPortrait person={p} className="h-full w-full" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{p.nombres} {p.apellidos}</span>
                  <span className="text-xs text-muted-foreground">ID {personaCode(p.id)}</span>
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Vista previa</CardTitle></CardHeader>
            <CardContent>
              {result ? <img src={result} alt="Cuadro genealógico generado" className="mx-auto max-h-[65dvh] max-w-full object-contain" /> : <div className="mx-auto max-w-xl rounded-3xl border bg-gradient-to-br from-white via-emerald-50 to-violet-50 p-8 text-center shadow-sm">
                <div ref={portraitRef} className="mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-white text-xl font-semibold ring-1 ring-border">
                  {selected ? <PersonPortrait person={selected} className="h-full w-full" /> : <UserRound className="h-8 w-8 text-muted-foreground" />}
                </div>
                <h2 className="mt-4 text-3xl font-semibold">{selected ? `${selected.nombres} ${selected.apellidos}` : "Selecciona una persona"}</h2>
                <p className="mt-1 text-muted-foreground">{selected?.nac_fecha?.slice(0, 4) ?? "Nacimiento no registrado"}-{selected?.defuncion_fecha?.slice(0, 4) ?? "Vive o sin dato"}</p>
              </div>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={generate} disabled={!selected || busy}><Sparkles className="h-4 w-4" /> {busy ? "Generando…" : "Generar cuadro"}</Button>
                <Button variant="outline" onClick={() => download("png")} disabled={!result}><Download className="h-4 w-4" /> PNG</Button>
                <Button variant="outline" onClick={() => download("pdf")} disabled={!result}><Download className="h-4 w-4" /> PDF</Button>
                <Button variant="outline" onClick={() => window.print()} disabled={!result}><Printer className="h-4 w-4" /> Imprimir</Button>
              </div>
            </CardContent>
          </Card>

          {result && createPortal(<div className="geneai-print-poster hidden">
            <style>{`@media print {body > :not(.geneai-print-poster){display:none!important} .geneai-print-poster{display:block!important} .geneai-print-poster img{max-width:100%;max-height:95vh;margin:auto;display:block}}`}</style>
            <img src={result} alt="" />
          </div>, document.body)}
        </div>
      </div>
    </div>
  );
}
