import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import CertezaBadge from "@/components/CertezaBadge";
import { Plus, EyeOff, Sparkles } from "lucide-react";
import { personaCode, matchesCode, normalizeCode } from "@/lib/personaCode";
import { toast } from "sonner";

export default function PersonasList() {
  const navigate = useNavigate();
  const [personas, setPersonas] = useState<any[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("personas").select("*").order("apellidos");
      setPersonas(data ?? []);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return personas;
    const lower = q.toLowerCase();
    const codeNorm = normalizeCode(q);
    const looksLikeCode = /^[A-Z2-9]{2,}-?[A-Z2-9]*$/i.test(q.trim()) && codeNorm.length >= 3;
    return personas.filter((p) => {
      if (looksLikeCode && matchesCode(q, p.id)) return true;
      return `${p.nombres} ${p.apellidos}`.toLowerCase().includes(lower);
    });
  }, [personas, q]);

  return (
    <div>
      <PageHeader
        title="Personas"
        subtitle="Toda persona del archivo. Cada una con su código único de identificación."
        actions={<Button onClick={() => navigate("/personas/nueva")}><Plus className="h-4 w-4" /> Nueva persona</Button>}
      />
      <Input
        placeholder="Buscar por nombre, apellido o código (ej. GDVB-TS5)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4 max-w-md"
      />
      {filtered.length === 0 ? (
        <Card className="archivo-card"><CardContent className="py-12 text-center text-muted-foreground">
          Sin resultados. Prueba con otro nombre o código.
        </CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((p) => (
            <div key={p.id}
              className="archivo-card flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:border-primary/40">
              <button onClick={() => navigate(`/personas/${p.id}`)} className="min-w-0 flex-1 text-left">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-bold text-foreground">{p.nombres}</span>
                  <span className="font-bold text-foreground">{p.apellidos}</span>
                  <span className="rounded-md border border-border/60 bg-foreground/5 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-muted-foreground">
                    {personaCode(p.id)}
                  </span>
                  {p.viva === "si" && <span title="Persona viva — privada"><EyeOff className="inline h-3.5 w-3.5 text-muted-foreground" /></span>}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {p.nac_fecha ? `n. ${new Date(p.nac_fecha).getUTCFullYear()}` : p.nac_rango_ini ? `n. ${p.nac_rango_ini}–${p.nac_rango_fin}` : "nacimiento s/d"}
                  {p.defuncion_fecha && ` — †${new Date(p.defuncion_fecha).getUTCFullYear()}`}
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  title={`Investigar a ${p.nombres} ${p.apellidos} con IA usando toda su información`}
                  onClick={async (e) => {
                    e.stopPropagation();
                    const t = toast.loading(`IA investigando a ${p.nombres} ${p.apellidos}…`);
                    try {
                      const { data, error } = await supabase.functions.invoke("busqueda-ia", { body: { modo: "persona", persona_id: p.id } });
                      toast.dismiss(t);
                      if (error) throw error;
                      if (data?.error) throw new Error(data.error);
                      toast.success(`+${data.hallazgos?.length ?? 0} hallazgo(s) — revísalos en Búsqueda IA`, {
                        action: { label: "Ver", onClick: () => navigate("/busqueda-ia") },
                      });
                    } catch (err: any) { toast.dismiss(t); toast.error(err.message ?? "Error"); }
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" /> IA
                </Button>
                <CertezaBadge value={p.certeza} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
