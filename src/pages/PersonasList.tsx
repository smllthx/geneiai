import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import CertezaBadge from "@/components/CertezaBadge";
import { Plus, EyeOff, Sparkles, GitMerge, ListOrdered, Link2 } from "lucide-react";
import { personaCode, matchesCode, normalizeCode } from "@/lib/personaCode";
import { toast } from "sonner";
import { suggestSurnameRelationships } from "@/lib/personAutoRules";

export default function PersonasList() {
  const navigate = useNavigate();
  const [personas, setPersonas] = useState<any[]>([]);
  const [relaciones, setRelaciones] = useState<any[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data }, { data: rels }] = await Promise.all([
        supabase.from("personas").select("*").order("apellidos"),
        supabase.from("relaciones").select("persona_id,pariente_id,tipo"),
      ]);
      setPersonas(data ?? []);
      setRelaciones(rels ?? []);
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

  const generarSugerenciasApellido = async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return toast.error("Sesión requerida");
    const existingPairs = new Set(
      relaciones.map((r) => [r.persona_id, r.pariente_id].sort().join(":")),
    );
    const candidates = suggestSurnameRelationships(personas, existingPairs);
    if (!candidates.length) return toast.info("No encontré nuevas relaciones probables por apellido.");
    const rows = candidates.map((s) => ({
      user_id: user.id,
      persona_id: s.personA.id,
      tipo: "relacion_por_apellido",
      titulo: `Revisar relación: ${s.personA.nombres} ${s.personA.apellidos} y ${s.personB.nombres} ${s.personB.apellidos}`,
      descripcion: s.reason,
      origen: "reglas_locales",
      confianza: s.confidence,
      payload: {
        person_a: s.personA.id,
        person_b: s.personB.id,
        shared_surname: s.sharedSurname,
        suggested_actions: ["hermano", "padre", "madre", "hijo", "otro"],
      },
    }));
    const { error } = await supabase.from("sugerencias").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} sugerencia(s) creadas por apellidos`, {
      action: { label: "Ver", onClick: () => navigate("/sugerencias") },
    });
  };

  return (
    <div>
      <PageHeader
        title="Personas"
        subtitle="Toda persona del archivo. Cada una con su código único de identificación."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/apellidos")}
              title="Ver personas agrupadas por apellido"
            >
              <ListOrdered className="h-4 w-4" /> Apellidos
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/fusionar")}
              title="Detectar y fusionar personas duplicadas"
            >
              <GitMerge className="h-4 w-4" /> Detectar duplicados
            </Button>
            <Button
              variant="outline"
              onClick={generarSugerenciasApellido}
              title="Sugerir conexiones familiares por apellidos compartidos"
            >
              <Link2 className="h-4 w-4" /> Sugerir relaciones
            </Button>
            <Button onClick={() => navigate("/personas/nueva")}>
              <Plus className="h-4 w-4" /> Nueva persona
            </Button>
          </div>
        }
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
