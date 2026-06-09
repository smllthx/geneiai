import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { generateInferences, nivelCerteza } from "@/lib/inferences/engine";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { applyTreeScope, fetchAllPeople, fetchAllRelations, getActiveTreeId, withTreeScope } from "@/lib/peopleData";

const LABEL_CERT: any = { alta: "Certeza alta", media: "Certeza media", baja: "Certeza baja" };

export default function Inferencias() {
  const [items, setItems] = useState<any[]>([]);
  const [personas, setPersonas] = useState<Record<string, any>>({});
  const [filter, setFilter] = useState<string>("pending");
  const [recalc, setRecalc] = useState(false);

  const load = async () => {
    const treeId = await getActiveTreeId();
    const ps = await fetchAllPeople("id,nombres,apellidos", { treeId });
    const scopedIds = new Set(ps.map((p) => p.id));
    setPersonas(Object.fromEntries((ps ?? []).map((p) => [p.id, p])));
    const { data } = await supabase.from("generated_inferences").select("*").order("confidence_score", { ascending: false });
    setItems((data ?? []).filter((row) => scopedIds.has(row.person_id)));
  };
  useEffect(() => { load(); }, []);

  const recalcAll = async () => {
    setRecalc(true);
    const user = (await supabase.auth.getUser()).data.user!;
    const treeId = await getActiveTreeId(user.id);
    const [pers, rels, { data: evs }, { data: ds }, { data: ls }] = await Promise.all([
      fetchAllPeople("*", { treeId }),
      fetchAllRelations("*", { treeId }),
      supabase.from("eventos").select("*"),
      applyTreeScope(supabase.from("documentos").select("*") as any, treeId),
      supabase.from("lugares").select("*"),
    ]);
    const scopedIds = new Set((pers ?? []).map((p: any) => p.id));
    const all = generateInferences({ personas: pers ?? [], relaciones: rels ?? [], eventos: evs ?? [], documentos: ds ?? [], lugares: ls ?? [] });
    const { data: oldPending } = await supabase.from("generated_inferences").select("id,person_id").eq("status", "pending");
    const oldIds = (oldPending ?? []).filter((row) => scopedIds.has(row.person_id)).map((row) => row.id);
    if (oldIds.length) await supabase.from("generated_inferences").delete().in("id", oldIds);
    if (all.length > 0) await supabase.from("generated_inferences").insert(all.map((i) => ({ ...i, user_id: user.id })));
    toast.success(`${all.length} inferencias generadas`);
    setRecalc(false); load();
  };

  const updateStatus = async (id: string, status: "pending" | "accepted_as_hypothesis" | "rejected" | "confirmed") => {
    await supabase.from("generated_inferences").update({ status }).eq("id", id);
    load();
  };

  const aceptarComoHipotesis = async (i: any) => {
    const user = (await supabase.auth.getUser()).data.user!;
    const persona = personas[i.person_id];
    await supabase.from("hipotesis").insert({
      user_id: user.id,
      titulo: `${i.inferred_field}: ${i.inferred_value} (${persona?.nombres ?? ""} ${persona?.apellidos ?? ""})`,
      descripcion: i.explanation,
      personas: [i.person_id, ...(i.related_person_ids ?? [])],
      probabilidad: i.confidence_score,
      estado: "abierta",
    });
    await updateStatus(i.id, "accepted_as_hypothesis");
    toast.success("Convertida en hipótesis");
  };

  const crearTarea = async (i: any) => {
    const user = (await supabase.auth.getUser()).data.user!;
    const tipoMap: any = {
      rango_matrimonio: "buscar_matrimonio", rango_nacimiento: "buscar_nacimiento",
      vivo_hasta: "buscar_defuncion", rango_migracion: "buscar_pasajeros",
    };
    const treeId = await getActiveTreeId(user.id);
    await supabase.from("research_tasks").insert(withTreeScope({
      user_id: user.id, person_id: i.person_id, inference_id: i.id,
      tipo: tipoMap[i.inference_type] ?? "otro",
      descripcion: i.explanation,
    }, treeId));
    toast.success("Tarea creada");
  };

  const crearBusqueda = async (i: any) => {
    const user = (await supabase.auth.getUser()).data.user!;
    const persona = personas[i.person_id];
    if (!persona) return;
    const q = `${persona.nombres} ${persona.apellidos} ${i.date_range_start ?? ""}`;
    await supabase.from("busquedas_externas").insert({
      user_id: user.id, persona_id: i.person_id,
      plataforma: "FamilySearch", objetivo: i.inferred_field,
      query: q.trim(),
      url: `https://www.familysearch.org/search/record/results?q.givenName=${encodeURIComponent(persona.nombres)}&q.surname=${encodeURIComponent(persona.apellidos)}`,
    });
    toast.success("Búsqueda guardada");
  };

  const filtered = items.filter((i) => filter === "all" || i.status === filter);

  return (
    <div>
      <PageHeader
        title="Inferencias familiares automáticas"
        subtitle="Hipótesis derivadas de los datos ya registrados, separadas por nivel de certeza."
        actions={
          <Button onClick={recalcAll} disabled={recalc}><RefreshCw className="h-4 w-4" /> {recalc ? "Calculando…" : "Recalcular todo"}</Button>
        }
      />

      <Card className="archivo-card mb-4 border-accent/30 bg-accent/5">
        <CardContent className="flex items-start gap-3 pt-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p>Esta información es inferida automáticamente. <strong>No debe considerarse comprobada</strong> hasta asociarla a una fuente documental.</p>
        </CardContent>
      </Card>

      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Mostrar:</span>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Abiertas (pending)</SelectItem>
            <SelectItem value="accepted_as_hypothesis">Aceptadas como hipótesis</SelectItem>
            <SelectItem value="rejected">Descartadas</SelectItem>
            <SelectItem value="confirmed">Confirmadas</SelectItem>
            <SelectItem value="all">Todas</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} resultado(s)</span>
      </div>

      {filtered.length === 0 ? (
        <Card className="archivo-card"><CardContent className="py-12 text-center text-muted-foreground">
          No hay inferencias en este filtro. Pulsa "Recalcular todo" para generar.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((i) => {
            const persona = personas[i.person_id];
            const niv = nivelCerteza(i.confidence_score);
            return (
              <Card key={i.id} className="archivo-card">
                <CardContent className="space-y-3 pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{i.rule_code} · {i.inference_type}</div>
                      <h3 className="font-serif text-xl">
                        {persona ? <Link to={`/personas/${persona.id}`} className="hover:underline">{persona.nombres} {persona.apellidos}</Link> : "Persona desconocida"}
                        {" — "}<span className="text-accent">{i.inferred_value}</span>
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="archivo-chip">{LABEL_CERT[niv]} · {i.confidence_score}/100</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{i.explanation}</p>
                  {i.status === "pending" && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => aceptarComoHipotesis(i)}>Aceptar como hipótesis</Button>
                      <Button size="sm" variant="outline" onClick={() => updateStatus(i.id, "rejected")}>Descartar</Button>
                      <Button size="sm" variant="outline" onClick={() => crearBusqueda(i)}>Crear búsqueda sugerida</Button>
                      <Button size="sm" variant="outline" onClick={() => crearTarea(i)}>Crear tarea de investigación</Button>
                    </div>
                  )}
                  {i.status !== "pending" && <div className="text-xs italic text-muted-foreground">Estado: {i.status}</div>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
