import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, GlassCard, EmptyState } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ExternalLink, FileText, Link as LinkIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Fuentes() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("documentos")
        .select("*")
        .order("created_at", { ascending: false });
      setDocs(data ?? []);
    })();
  }, []);

  return (
    <div>
      <SectionHeader
        eyebrow="Citas y referencias"
        title="Fuentes documentales"
        subtitle="Citas, links, archivos, extractos y transcripciones que respaldan personas y eventos del árbol."
        actions={<Button variant="outline" onClick={() => navigate("/documentos")}><FileText className="h-4 w-4" /> Nueva fuente o documento</Button>}
      />
      {docs.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-5 w-5" />} title="Aún sin fuentes" description="Agrega documentos, links, citas o extractos y vincúlalos a una persona del árbol." />
      ) : (
        <div className="grid gap-3">
          {docs.map((d) => (
            <button key={d.id} onClick={() => navigate(`/documentos/${d.id}`)} className="text-left">
              <GlassCard interactive>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent"><BookOpen className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-base font-semibold">{d.titulo}</h3>
                    {d.cita && <p className="mt-1 line-clamp-2 text-sm italic text-muted-foreground">{d.cita}</p>}
                    {!d.cita && d.resumen && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{d.resumen}</p>}
                    {d.repositorio && <p className="mt-1 text-xs text-muted-foreground">{d.repositorio}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="outline">{d.tipo ?? "fuente"}</Badge>
                      <Badge variant={d.estado === "verificado" ? "default" : "secondary"}>{d.estado ?? "pendiente"}</Badge>
                      {d.url && <Badge variant="outline"><ExternalLink className="mr-1 h-3 w-3" /> link</Badge>}
                      {d.archivo_path && <Badge variant="outline"><FileText className="mr-1 h-3 w-3" /> archivo</Badge>}
                      {(d.personas_mencionadas ?? []).length > 0 && <Badge variant="outline"><LinkIcon className="mr-1 h-3 w-3" /> {(d.personas_mencionadas ?? []).length} personas</Badge>}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
