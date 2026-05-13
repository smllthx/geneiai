import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import CertezaBadge from "@/components/CertezaBadge";
import { Trash2, Save, ArrowLeft, Globe, AlertTriangle } from "lucide-react";
import { generateExternalSearches } from "@/lib/external-searches";
import { generateInferences } from "@/lib/inferences/engine";

const empty: any = {
  nombres: "", apellidos: "", variantes_nombre: [], sexo: "",
  nac_fecha: null, nac_fecha_aprox: "", nac_rango_ini: null, nac_rango_fin: null,
  bautismo_fecha: null, matrimonio_fecha: null, defuncion_fecha: null, entierro_fecha: null,
  ocupacion: "", nacionalidad: "", religion: "", notas: "",
  certeza: "probable", viva: "desconocido", ids_externos: {}, enlaces: [],
};

export default function PersonaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "nueva";
  const [p, setP] = useState<any>(empty);
  const [eventos, setEventos] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [relaciones, setRelaciones] = useState<any[]>([]);
  const [allPersonas, setAllPersonas] = useState<any[]>([]);
  const [inferences, setInferences] = useState<any[]>([]);
  const [hipos, setHipos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: ap } = await supabase.from("personas").select("*").order("apellidos");
      setAllPersonas(ap ?? []);
      if (isNew) return;
      const { data } = await supabase.from("personas").select("*").eq("id", id!).maybeSingle();
      if (data) setP(data);
      const [{ data: ev }, { data: rel }, { data: hip }, { data: inf }] = await Promise.all([
        supabase.from("eventos").select("*").eq("persona_id", id!).order("fecha", { ascending: true }),
        supabase.from("relaciones").select("*, pariente:personas!relaciones_pariente_id_fkey(*)").or(`persona_id.eq.${id},pariente_id.eq.${id}`),
        supabase.from("hipotesis").select("*").contains("personas", [id!]),
        supabase.from("generated_inferences").select("*").eq("person_id", id!).order("confidence_score", { ascending: false }),
      ]);
      setEventos(ev ?? []); setRelaciones(rel ?? []); setHipos(hip ?? []); setInferences(inf ?? []);
      const { data: d } = await supabase.from("documentos").select("*").contains("personas_mencionadas", [id!]);
      setDocs(d ?? []);
    })();
  }, [id, isNew]);

  const save = async () => {
    setLoading(true);
    const user = (await supabase.auth.getUser()).data.user!;
    const payload = { ...p, user_id: user.id };
    delete payload.id;
    if (isNew) {
      const { data, error } = await supabase.from("personas").insert(payload).select().single();
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success("Persona creada");
      navigate(`/personas/${data.id}`);
    } else {
      const { error } = await supabase.from("personas").update(payload).eq("id", id!);
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success("Cambios guardados");
    }
  };

  const eliminar = async () => {
    if (!confirm("¿Eliminar esta persona y sus relaciones?")) return;
    await supabase.from("personas").delete().eq("id", id!);
    navigate("/personas");
  };

  const recalcularInferencias = async () => {
    const user = (await supabase.auth.getUser()).data.user!;
    const [{ data: personas }, { data: rels }, { data: evs }, { data: ds }, { data: ls }] = await Promise.all([
      supabase.from("personas").select("*"),
      supabase.from("relaciones").select("*"),
      supabase.from("eventos").select("*"),
      supabase.from("documentos").select("*"),
      supabase.from("lugares").select("*"),
    ]);
    const all = generateInferences({ personas: personas ?? [], relaciones: rels ?? [], eventos: evs ?? [], documentos: ds ?? [], lugares: ls ?? [] });
    const mine = all.filter((i) => i.person_id === id);
    if (mine.length === 0) { toast.info("No se generaron nuevas inferencias para esta persona."); return; }
    await supabase.from("generated_inferences").delete().eq("person_id", id!).eq("status", "pending");
    await supabase.from("generated_inferences").insert(mine.map((i) => ({ ...i, user_id: user.id })));
    toast.success(`${mine.length} inferencias generadas`);
    const { data } = await supabase.from("generated_inferences").select("*").eq("person_id", id!).order("confidence_score", { ascending: false });
    setInferences(data ?? []);
  };

  const set = (k: string, v: any) => setP({ ...p, [k]: v });

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate("/personas")} className="mb-2"><ArrowLeft className="h-4 w-4" /> Volver</Button>
      <PageHeader
        title={isNew ? "Nueva persona" : `${p.nombres} ${p.apellidos}`.trim() || "Persona"}
        subtitle={isNew ? "Registrar nombre, fechas y datos básicos." : undefined}
        actions={<>
          <Button onClick={save} disabled={loading}><Save className="h-4 w-4" /> Guardar</Button>
          {!isNew && <Button variant="outline" onClick={eliminar}><Trash2 className="h-4 w-4" /> Eliminar</Button>}
        </>}
      />

      {!isNew && <div className="mb-4 flex items-center gap-2"><CertezaBadge value={p.certeza} />{p.viva === "si" && <span className="archivo-chip">Persona viva — privada</span>}</div>}

      <Tabs defaultValue="resumen">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="familia">Familia</TabsTrigger>
          <TabsTrigger value="eventos">Eventos</TabsTrigger>
          <TabsTrigger value="fuentes">Fuentes</TabsTrigger>
          <TabsTrigger value="busquedas">Búsquedas</TabsTrigger>
          <TabsTrigger value="hipotesis">Hipótesis</TabsTrigger>
          <TabsTrigger value="inferencias">Inferencias</TabsTrigger>
          <TabsTrigger value="timeline">Línea de tiempo</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <Card className="archivo-card"><CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            <div><Label>Nombres</Label><Input value={p.nombres ?? ""} onChange={(e) => set("nombres", e.target.value)} /></div>
            <div><Label>Apellidos</Label><Input value={p.apellidos ?? ""} onChange={(e) => set("apellidos", e.target.value)} /></div>
            <div><Label>Variantes de nombre/apellido (separadas por coma)</Label>
              <Input value={(p.variantes_nombre ?? []).join(", ")} onChange={(e) => set("variantes_nombre", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></div>
            <div><Label>Sexo / género histórico</Label>
              <Select value={p.sexo ?? ""} onValueChange={(v) => set("sexo", v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value="masculino">Masculino</SelectItem><SelectItem value="femenino">Femenino</SelectItem><SelectItem value="otro">Otro</SelectItem></SelectContent>
              </Select></div>
            <div><Label>Fecha de nacimiento</Label><Input type="date" value={p.nac_fecha ?? ""} onChange={(e) => set("nac_fecha", e.target.value || null)} /></div>
            <div><Label>Fecha aproximada (texto)</Label><Input value={p.nac_fecha_aprox ?? ""} onChange={(e) => set("nac_fecha_aprox", e.target.value)} placeholder="hacia 1880" /></div>
            <div><Label>Rango de nacimiento (años)</Label>
              <div className="flex gap-2"><Input type="number" placeholder="desde" value={p.nac_rango_ini ?? ""} onChange={(e) => set("nac_rango_ini", e.target.value ? parseInt(e.target.value) : null)} />
                <Input type="number" placeholder="hasta" value={p.nac_rango_fin ?? ""} onChange={(e) => set("nac_rango_fin", e.target.value ? parseInt(e.target.value) : null)} /></div></div>
            <div><Label>Fecha de defunción</Label><Input type="date" value={p.defuncion_fecha ?? ""} onChange={(e) => set("defuncion_fecha", e.target.value || null)} /></div>
            <div><Label>Fecha de bautismo</Label><Input type="date" value={p.bautismo_fecha ?? ""} onChange={(e) => set("bautismo_fecha", e.target.value || null)} /></div>
            <div><Label>Fecha de matrimonio</Label><Input type="date" value={p.matrimonio_fecha ?? ""} onChange={(e) => set("matrimonio_fecha", e.target.value || null)} /></div>
            <div><Label>Ocupación</Label><Input value={p.ocupacion ?? ""} onChange={(e) => set("ocupacion", e.target.value)} /></div>
            <div><Label>Nacionalidad / origen</Label><Input value={p.nacionalidad ?? ""} onChange={(e) => set("nacionalidad", e.target.value)} /></div>
            <div><Label>Religión / rito</Label><Input value={p.religion ?? ""} onChange={(e) => set("religion", e.target.value)} /></div>
            <div><Label>Certeza</Label>
              <Select value={p.certeza} onValueChange={(v) => set("certeza", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comprobado">Comprobado</SelectItem>
                  <SelectItem value="probable">Probable</SelectItem>
                  <SelectItem value="hipotesis">Hipótesis</SelectItem>
                  <SelectItem value="descartado">Descartado</SelectItem>
                </SelectContent>
              </Select></div>
            <div><Label>Persona viva</Label>
              <Select value={p.viva} onValueChange={(v) => set("viva", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="si">Sí (privada)</SelectItem><SelectItem value="no">No</SelectItem><SelectItem value="desconocido">Desconocido</SelectItem></SelectContent>
              </Select></div>
            <div className="md:col-span-2"><Label>Notas biográficas</Label>
              <Textarea rows={4} value={p.notas ?? ""} onChange={(e) => set("notas", e.target.value)} /></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="familia">
          <RelacionesPanel personaId={id!} relaciones={relaciones} allPersonas={allPersonas} reload={async () => {
            const { data } = await supabase.from("relaciones").select("*, pariente:personas!relaciones_pariente_id_fkey(*)").or(`persona_id.eq.${id},pariente_id.eq.${id}`);
            setRelaciones(data ?? []);
          }} disabled={isNew} />
        </TabsContent>

        <TabsContent value="eventos">
          <EventosPanel personaId={id!} eventos={eventos} reload={async () => {
            const { data } = await supabase.from("eventos").select("*").eq("persona_id", id!).order("fecha");
            setEventos(data ?? []);
          }} disabled={isNew} />
        </TabsContent>

        <TabsContent value="fuentes">
          {docs.length === 0 ? <p className="text-sm text-muted-foreground">Sin documentos vinculados aún.</p> :
            <ul className="grid gap-2">{docs.map((d) => (
              <li key={d.id} className="archivo-card px-4 py-3"><div className="font-medium">{d.titulo}</div>
                <div className="text-xs text-muted-foreground">{d.tipo} · {d.fecha ?? "s/f"} · {d.estado}</div></li>
            ))}</ul>}
        </TabsContent>

        <TabsContent value="busquedas">
          <BusquedasSugeridas persona={p} disabled={isNew} />
        </TabsContent>

        <TabsContent value="hipotesis">
          {hipos.length === 0 ? <p className="text-sm text-muted-foreground">Sin hipótesis vinculadas.</p> :
            <ul className="grid gap-2">{hipos.map((h) => (
              <li key={h.id} className="archivo-card px-4 py-3"><div className="font-medium">{h.titulo}</div>
                <div className="text-xs text-muted-foreground">Estado: {h.estado} · Probabilidad: {h.probabilidad}%</div></li>
            ))}</ul>}
        </TabsContent>

        <TabsContent value="inferencias">
          <Card className="archivo-card border-accent/30 bg-accent/5">
            <CardContent className="flex items-start gap-3 pt-4 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <p>Esta información es inferida automáticamente. No debe considerarse comprobada hasta asociarla a una fuente documental.</p>
            </CardContent>
          </Card>
          <div className="my-3"><Button size="sm" onClick={recalcularInferencias} disabled={isNew}>Recalcular inferencias</Button></div>
          {inferences.length === 0 ? <p className="text-sm text-muted-foreground">Sin inferencias para esta persona.</p> :
            <div className="grid gap-2">{inferences.map((i) => (
              <Card key={i.id} className="archivo-card">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-serif text-lg">{i.inferred_value}</div>
                    <span className="archivo-chip">{i.rule_code} · {i.confidence_score}/100</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{i.explanation}</p>
                </CardContent>
              </Card>
            ))}</div>}
        </TabsContent>

        <TabsContent value="timeline">
          <TimelinePanel eventos={eventos} persona={p} />
        </TabsContent>

        <TabsContent value="notas">
          <Textarea rows={12} value={p.notas ?? ""} onChange={(e) => set("notas", e.target.value)} placeholder="Notas extensas, hipótesis, ideas…" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RelacionesPanel({ personaId, relaciones, allPersonas, reload, disabled }: any) {
  const [tipo, setTipo] = useState("padre");
  const [pariente, setPariente] = useState("");
  const add = async () => {
    if (!pariente) return;
    const user = (await supabase.auth.getUser()).data.user!;
    const { error } = await supabase.from("relaciones").insert({ user_id: user.id, persona_id: personaId, pariente_id: pariente, tipo: tipo as any });
    if (error) return toast.error(error.message);
    setPariente(""); reload();
  };
  const del = async (rid: string) => { await supabase.from("relaciones").delete().eq("id", rid); reload(); };
  if (disabled) return <p className="text-sm text-muted-foreground">Guarda la persona primero para añadir relaciones.</p>;
  return (
    <Card className="archivo-card"><CardContent className="space-y-4 pt-6">
      <div className="grid gap-2 md:grid-cols-[160px,1fr,auto]">
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="padre">Padre</SelectItem><SelectItem value="madre">Madre</SelectItem>
            <SelectItem value="conyuge">Cónyuge</SelectItem><SelectItem value="hijo">Hijo/a</SelectItem>
            <SelectItem value="hermano">Hermano/a</SelectItem><SelectItem value="otro">Otro</SelectItem>
          </SelectContent>
        </Select>
        <Select value={pariente} onValueChange={setPariente}>
          <SelectTrigger><SelectValue placeholder="Elegir pariente…" /></SelectTrigger>
          <SelectContent>{allPersonas.filter((x: any) => x.id !== personaId).map((x: any) =>
            <SelectItem key={x.id} value={x.id}>{x.nombres} {x.apellidos}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={add}>Añadir</Button>
      </div>
      <ul className="divide-y divide-border">{relaciones.map((r: any) => (
        <li key={r.id} className="flex items-center justify-between py-2 text-sm">
          <span><strong>{r.tipo}</strong>: {r.pariente?.nombres} {r.pariente?.apellidos}</span>
          <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>
        </li>
      ))}</ul>
    </CardContent></Card>
  );
}

function EventosPanel({ personaId, eventos, reload, disabled }: any) {
  const [draft, setDraft] = useState({ tipo: "nacimiento", fecha: "", lugar_original: "", descripcion: "", certeza: "probable" });
  const add = async () => {
    const user = (await supabase.auth.getUser()).data.user!;
    const payload: any = { ...draft, user_id: user.id, persona_id: personaId, fecha: draft.fecha || null };
    const { error } = await supabase.from("eventos").insert(payload);
    if (error) return toast.error(error.message);
    setDraft({ tipo: "nacimiento", fecha: "", lugar_original: "", descripcion: "", certeza: "probable" });
    reload();
  };
  const del = async (id: string) => { await supabase.from("eventos").delete().eq("id", id); reload(); };
  if (disabled) return <p className="text-sm text-muted-foreground">Guarda la persona primero para añadir eventos.</p>;
  return (
    <Card className="archivo-card"><CardContent className="space-y-4 pt-6">
      <div className="grid gap-2 md:grid-cols-5">
        <Select value={draft.tipo} onValueChange={(v) => setDraft({ ...draft, tipo: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{["nacimiento","bautismo","matrimonio","inmigracion","viaje","residencia","censo","defuncion","entierro","otro"].map((t) =>
            <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={draft.fecha} onChange={(e) => setDraft({ ...draft, fecha: e.target.value })} />
        <Input placeholder="Lugar (texto)" value={draft.lugar_original} onChange={(e) => setDraft({ ...draft, lugar_original: e.target.value })} />
        <Input placeholder="Descripción" value={draft.descripcion} onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })} />
        <Button onClick={add}>Añadir evento</Button>
      </div>
      <ul className="divide-y divide-border">{eventos.map((e: any) => (
        <li key={e.id} className="flex items-center justify-between py-2 text-sm">
          <span><strong className="capitalize">{e.tipo}</strong> · {e.fecha ?? "s/f"} · {e.lugar_original ?? ""} <em className="text-muted-foreground">{e.descripcion}</em></span>
          <Button size="sm" variant="ghost" onClick={() => del(e.id)}><Trash2 className="h-4 w-4" /></Button>
        </li>
      ))}</ul>
    </CardContent></Card>
  );
}

function BusquedasSugeridas({ persona, disabled }: any) {
  if (disabled) return <p className="text-sm text-muted-foreground">Guarda la persona primero.</p>;
  const sugs = generateExternalSearches(persona);
  return (
    <div className="grid gap-2 md:grid-cols-2">{sugs.map((s, i) => (
      <Card key={i} className="archivo-card"><CardHeader className="pb-2">
        <CardTitle className="font-serif text-base">{s.plataforma}</CardTitle>
      </CardHeader><CardContent className="space-y-2 pt-0">
        <p className="text-xs text-muted-foreground">{s.objetivo}</p>
        <code className="block break-all rounded bg-muted px-2 py-1 text-xs">{s.query}</code>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(s.query); toast.success("Copiado"); }}>Copiar</Button>
          <Button size="sm" asChild><a href={s.url} target="_blank" rel="noopener noreferrer"><Globe className="h-3.5 w-3.5" /> Abrir</a></Button>
        </div>
      </CardContent></Card>
    ))}</div>
  );
}

function TimelinePanel({ eventos, persona }: any) {
  const items = [
    persona.nac_fecha && { fecha: persona.nac_fecha, label: "Nacimiento" },
    persona.bautismo_fecha && { fecha: persona.bautismo_fecha, label: "Bautismo" },
    persona.matrimonio_fecha && { fecha: persona.matrimonio_fecha, label: "Matrimonio" },
    ...eventos.map((e: any) => ({ fecha: e.fecha, label: `${e.tipo}${e.lugar_original ? " · " + e.lugar_original : ""}` })),
    persona.defuncion_fecha && { fecha: persona.defuncion_fecha, label: "Defunción" },
  ].filter(Boolean).filter((x: any) => x.fecha).sort((a: any, b: any) => a.fecha.localeCompare(b.fecha));
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Sin fechas suficientes para construir una línea de tiempo.</p>;
  return (
    <ol className="relative ml-3 border-l border-border pl-6">
      {items.map((it: any, i: number) => (
        <li key={i} className="mb-4">
          <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-primary" />
          <div className="font-serif text-lg">{new Date(it.fecha).getUTCFullYear()}</div>
          <div className="text-sm text-muted-foreground">{it.label}</div>
        </li>
      ))}
    </ol>
  );
}
