import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, GlassCard, EmptyState } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Fuentes() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("documentos")
        .select("*")
        .not("cita", "is", null)
        .order("fecha", { ascending: false });
      setDocs(data ?? []);
    })();
  }, []);

  return (
    <div>
      <SectionHeader
        eyebrow="Citas y referencias"
        title="Fuentes documentales"
        subtitle="Documentos con cita registrada que respaldan los hechos del archivo."
        actions={<Button variant="outline" onClick={() => navigate("/documentos")}><FileText className="h-4 w-4" /> Ver todos los documentos</Button>}
      />
      {docs.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-5 w-5" />} title="Aún sin fuentes citadas" description="Agrega una cita (referencia bibliográfica o de archivo) a tus documentos para verlos aquí." />
      ) : (
        <div className="grid gap-3">
          {docs.map((d) => (
            <button key={d.id} onClick={() => navigate(`/documentos/${d.id}`)} className="text-left">
              <GlassCard interactive>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent"><BookOpen className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-base font-semibold">{d.titulo}</h3>
                    <p className="mt-1 text-sm italic text-muted-foreground">{d.cita}</p>
                    {d.repositorio && <p className="mt-1 text-xs text-muted-foreground">📁 {d.repositorio}</p>}
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
