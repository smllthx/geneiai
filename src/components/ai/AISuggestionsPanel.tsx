import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Eye, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveTreeId, withTreeScope } from "@/lib/peopleData";
import { suggestRelationsAI } from "@/lib/aiApi";

type AISuggestion = {
  id: string;
  person_id: string | null;
  suggestion_type: string;
  title: string;
  description: string | null;
  details: any;
  confidence: number;
  status: string;
  created_at: string;
};

const relationMap: Record<string, string> = {
  padre: "padre",
  madre: "madre",
  conyuge: "conyuge",
  cónyuge: "conyuge",
  hijo: "hijo",
  hija: "hijo",
  hermano: "hermano",
  hermana: "hermano",
};

export default function AISuggestionsPanel({ personId, compact = false }: { personId?: string; compact?: boolean }) {
  const [items, setItems] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const treeId = await getActiveTreeId();
      let query = supabase
        .from("ai_suggestions" as any)
        .select("*")
        .eq("status", "pendiente")
        .order("created_at", { ascending: false })
        .limit(200);
      if (personId) query = query.eq("person_id", personId);
      if (treeId) query = query.or(`arbol_id.eq.${treeId},arbol_id.is.null`);
      const { data, error } = await query;
      if (error) throw error;
      setItems((data ?? []) as any);
    } catch (e: any) {
      toast.error(e.message ?? "No se pudieron cargar sugerencias de IA");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [personId]);

  const grouped = useMemo(() => {
    const map = new Map<string, AISuggestion[]>();
    for (const item of items) {
      const key = item.suggestion_type || "otro";
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [items]);

  const reject = async (id: string) => {
    const { error } = await supabase.from("ai_suggestions" as any).update({ status: "rechazado" }).eq("id", id);
    if (error) return toast.error(error.message);
    setItems((xs) => xs.filter((x) => x.id !== id));
    toast.success("Sugerencia rechazada");
  };

  const accept = async (s: AISuggestion) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return toast.error("Sesión no encontrada");
    const treeId = await getActiveTreeId(user.id);
    const details = s.details ?? {};

    if (s.suggestion_type === "relacion") {
      const source = details.source_person_id ?? s.person_id;
      const target = details.target_person_id;
      const tipo = relationMap[String(details.relation_type ?? details.relationship ?? "").toLowerCase()];
      if (!source || !target || !tipo) {
        return toast.info("Esta sugerencia necesita revisión manual porque falta persona o tipo de relación.");
      }
      const row = withTreeScope({
        user_id: user.id,
        persona_id: source,
        pariente_id: target,
        tipo,
        certeza: "probable",
        naturaleza: "biologica",
        notas: `Sugerido por IA: ${s.description ?? s.title}`,
      }, treeId);
      const { error } = await supabase.from("relaciones").insert(row as any);
      if (error && !String(error.message).toLowerCase().includes("duplicate")) return toast.error(error.message);
    }

    const { error } = await supabase.from("ai_suggestions" as any).update({ status: "aceptado" }).eq("id", s.id);
    if (error) return toast.error(error.message);
    setItems((xs) => xs.filter((x) => x.id !== s.id));
    window.dispatchEvent(new CustomEvent("genaia:data-changed", { detail: { source: "ai_suggestions" } }));
    toast.success("Sugerencia aceptada");
  };

  const runForPerson = async () => {
    if (!personId) return;
    setRunning(true);
    const t = toast.loading("Buscando sugerencias con IA…");
    try {
      const result = await suggestRelationsAI(personId);
      toast.dismiss(t);
      toast.success(`${result.created ?? 0} sugerencias generadas`);
      await load();
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e.message ?? "No se pudo generar sugerencias");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="archivo-card">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 font-serif text-lg">
          <Sparkles className="h-5 w-5 text-cyan-300" /> Sugerencias de IA
        </CardTitle>
        <div className="flex gap-2">
          {personId && (
            <Button size="sm" variant="outline" onClick={runForPerson} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Buscar
            </Button>
          )}
          {!compact && <Button size="sm" variant="ghost" asChild><Link to="/tareas-ia">Ver todo</Link></Button>}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay sugerencias pendientes. Puedes generar nuevas desde esta ficha o analizar documentos.</p>
        ) : (
          <div className="space-y-4">
            {grouped.map(([type, list]) => (
              <div key={type} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{type}</p>
                {list.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-white/10 bg-background/40 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{s.title}</p>
                        <p className="text-sm text-muted-foreground">{s.description ?? "Sin descripción"}</p>
                      </div>
                      <Badge variant="secondary">{s.confidence}%</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline"><Eye className="h-4 w-4" /> Detalles</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader><DialogTitle>Detalle de sugerencia</DialogTitle></DialogHeader>
                          <pre className="max-h-[60vh] overflow-auto rounded-2xl bg-muted p-3 text-xs">{JSON.stringify(s.details, null, 2)}</pre>
                        </DialogContent>
                      </Dialog>
                      <Button size="sm" onClick={() => accept(s)}><Check className="h-4 w-4" /> Aceptar</Button>
                      <Button size="sm" variant="outline" onClick={() => reject(s.id)}><X className="h-4 w-4" /> Rechazar</Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
