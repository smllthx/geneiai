import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import AISuggestionsPanel from "@/components/ai/AISuggestionsPanel";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getActiveTreeId } from "@/lib/peopleData";

type Row = {
  id: string;
  suggestion_type: string;
  title: string;
  description: string | null;
  status: string;
  confidence: number;
  created_at: string;
};

export default function TareasIA() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("pendiente");
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const treeId = await getActiveTreeId();
      let query = supabase.from("ai_suggestions" as any).select("id,suggestion_type,title,description,status,confidence,created_at").order("created_at", { ascending: false }).limit(1000);
      if (status !== "all") query = query.eq("status", status);
      if (type !== "all") query = query.eq("suggestion_type", type);
      if (treeId) query = query.or(`arbol_id.eq.${treeId},arbol_id.is.null`);
      const { data, error } = await query;
      if (error) throw error;
      setItems((data ?? []) as any);
    } catch (e: any) {
      toast.error(e.message ?? "No se pudieron cargar tareas IA");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [type, status]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((x) => `${x.title} ${x.description ?? ""}`.toLowerCase().includes(needle));
  }, [items, q]);

  const bulk = async (nextStatus: "aceptado" | "rechazado") => {
    const ids = filtered.filter((x) => x.status === "pendiente").map((x) => x.id);
    if (!ids.length) return toast.info("No hay tareas pendientes en este filtro");
    const { error } = await supabase.from("ai_suggestions" as any).update({ status: nextStatus }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} tarea(s) actualizadas`);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Tareas IA"
        subtitle="Revisa sugerencias de relaciones, duplicados y eventos. Nada se aplica sin tu aprobación."
        actions={<Button onClick={load} variant="outline"><Sparkles className="h-4 w-4" /> Actualizar</Button>}
      />

      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_180px_180px_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar sugerencia…" className="pl-9" />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="relacion">Relaciones</SelectItem>
            <SelectItem value="duplicado">Duplicados</SelectItem>
            <SelectItem value="evento">Eventos</SelectItem>
            <SelectItem value="fuente">Fuentes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pendiente">Pendientes</SelectItem>
            <SelectItem value="aceptado">Aceptadas</SelectItem>
            <SelectItem value="rechazado">Rechazadas</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => bulk("aceptado")}><Check className="h-4 w-4" /> Aceptar filtro</Button>
        <Button variant="outline" onClick={() => bulk("rechazado")}><X className="h-4 w-4" /> Rechazar filtro</Button>
      </div>

      {loading ? (
        <div className="grid min-h-[30vh] place-items-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="archivo-card"><CardContent className="py-12 text-center text-muted-foreground">No hay tareas IA para este filtro.</CardContent></Card>
      ) : (
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          {filtered.slice(0, 30).map((item) => (
            <Card key={item.id} className="archivo-card">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <Badge variant="secondary">{item.confidence}%</Badge>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{item.suggestion_type} · {item.status}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AISuggestionsPanel compact />
    </div>
  );
}
