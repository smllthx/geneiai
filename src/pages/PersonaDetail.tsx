import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import CertezaBadge from "@/components/CertezaBadge";
import { Trash2, Save, ArrowLeft, Globe, AlertTriangle, Sparkles, GitBranch, Pencil } from "lucide-react";
import { generateExternalSearches } from "@/lib/external-searches";
import { generateInferences } from "@/lib/inferences/engine";
import QuickAddRelative from "@/components/QuickAddRelative";
import PersonaHero from "@/components/PersonaHero";
import { Link } from "react-router-dom";
import LugarSelect, { useLugares } from "@/components/LugarSelect";
import { notify } from "@/lib/notifications";
import { padresDe as kPadresDe, conyugesDe as kConyugesDe, hijosDe as kHijosDe, hermanosDe as kHermanosDe } from "@/lib/kinship";
import { personaCode, matchesCode } from "@/lib/personaCode";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ND = <span className="text-muted-foreground italic">Dato no registrado</span>;
const fmtDate = (d: string | null | undefined) => {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString("es", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }); }
  catch { return d; }
};
const yearOf = (d: string | null | undefined) => (d ? new Date(d).getUTCFullYear() : null);

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
  const { user } = useAuth();
  const isNew = id === "nueva";
  const idValid = isNew || (!!id && UUID_RE.test(id));
  const [p, setP] = useState<any>(empty);
  const [eventos, setEventos] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [relaciones, setRelaciones] = useState<any[]>([]);
  const [allPersonas, setAllPersonas] = useState<any[]>([]);
  const [inferences, setInferences] = useState<any[]>([]);
  const [hipos, setHipos] = useState<any[]>([]);
  const [fotos, setFotos] = useState<any[]>([]);
  const [coincidencias, setCoincidencias] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!isNew);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(isNew);
  const [lugares, setLugares] = useLugares();

  useEffect(() => {
    if (!idValid) { setFetching(false); return; }
    (async () => {
      try {
        setFetching(true); setFetchError(null); setNotFound(false);
        const { data: ap } = await supabase.from("personas").select("*").order("apellidos");
        setAllPersonas(ap ?? []);
        if (isNew) { setFetching(false); return; }
        const { data, error } = await supabase.from("personas").select("*").eq("id", id!).maybeSingle();
        if (error) throw error;
        if (!data) { setNotFound(true); setFetching(false); return; }
        setP(data);
        const [{ data: ev }, { data: rel }, { data: hip }, { data: inf }] = await Promise.all([
          supabase.from("eventos").select("*").eq("persona_id", id!).order("fecha", { ascending: true }),
          supabase.from("relaciones").select("*, pariente:personas!relaciones_pariente_id_fkey(*)").or(`persona_id.eq.${id},pariente_id.eq.${id}`),
          supabase.from("hipotesis").select("*").contains("personas", [id!]),
          supabase.from("generated_inferences").select("*").eq("person_id", id!).order("confidence_score", { ascending: false }),
        ]);
        setEventos(ev ?? []); setRelaciones(rel ?? []); setHipos(hip ?? []); setInferences(inf ?? []);
        const [{ data: d }, { data: ft }, { data: co }] = await Promise.all([
          supabase.from("documentos").select("*").contains("personas_mencionadas", [id!]),
          supabase.from("fotos").select("*").contains("personas_ids", [id!]).order("created_at", { ascending: false }),
          supabase.from("coincidencias").select("*").or(`ref_a.eq.${id},ref_b.eq.${id}`),
        ]);
        setDocs(d ?? []); setFotos(ft ?? []); setCoincidencias(co ?? []);
      } catch (e: any) {
        setFetchError(e?.message ?? "Error al cargar la persona");
      } finally { setFetching(false); }
    })();
  }, [id, isNew, idValid]);

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

  // Use the unified kinship helpers so this panel matches the tree, fan chart and dynasty view
  const fam = useMemo(() => {
    if (!id) return { padres: [], conyuges: [], hijos: [], hermanos: [], otros: [] };
    // Build a flat byId map from relaciones.pariente joins + the loaded personas
    const byId = new Map<string, any>();
    for (const ap of allPersonas) byId.set(ap.id, ap);
    for (const r of relaciones) if (r.pariente?.id) byId.set(r.pariente.id, r.pariente);
    if (p?.id) byId.set(p.id, p);
    // Normalise rows so helper sees both directions (relaciones returned for this person already include both)
    const flat = relaciones.map((r: any) => ({ id: r.id, persona_id: r.persona_id, pariente_id: r.pariente_id, tipo: r.tipo }));
    const padres = kPadresDe(id, flat, byId).all;
    const conyuges = kConyugesDe(id, flat, byId);
    const hijos = kHijosDe(id, flat, byId);
    const hermanos = kHermanosDe(id, flat, byId);
    // "otros": cualquier persona referenciada en relaciones que no caiga en las categorías anteriores
    const known = new Set([...padres, ...conyuges, ...hijos, ...hermanos].map((x: any) => x.id));
    const otros = relaciones
      .map((r: any) => r.pariente)
      .filter((x: any) => x?.id && x.id !== id && !known.has(x.id))
      // dedupe
      .filter((x: any, i: number, arr: any[]) => arr.findIndex((y) => y.id === x.id) === i);
    return { padres, conyuges, hijos, hermanos, otros };
  }, [relaciones, id, p, allPersonas]);

  if (!idValid) {
    return (
      <div className="mx-auto max-w-xl pt-10 text-center">
        <h1 className="font-serif text-2xl">Identificador inválido</h1>
        <p className="mt-2 text-sm text-muted-foreground">El enlace de esta persona no es válido.</p>
        <Button className="mt-4" onClick={() => navigate("/personas")}><ArrowLeft className="h-4 w-4" /> Ir a Personas</Button>
      </div>
    );
  }
  if (fetching) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (fetchError) {
    return (
      <div className="mx-auto max-w-xl pt-10 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
        <h1 className="mt-2 font-serif text-2xl">No se pudo cargar la persona</h1>
        <p className="mt-2 text-sm text-muted-foreground">{fetchError}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>Reintentar</Button>
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="mx-auto max-w-xl pt-10 text-center">
        <h1 className="font-serif text-2xl">Persona no encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">No existe ninguna persona con este identificador, o no tienes acceso.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" onClick={() => navigate("/personas")}><ArrowLeft className="h-4 w-4" /> Personas</Button>
          <Button onClick={() => navigate("/arbol")}><GitBranch className="h-4 w-4" /> Volver al árbol</Button>
        </div>
      </div>
    );
  }

  const fullName = `${p.nombres ?? ""} ${p.apellidos ?? ""}`.trim() || "Persona";
  const yNac = yearOf(p.nac_fecha) ?? p.nac_rango_ini ?? null;
  const yDef = yearOf(p.defuncion_fecha) ?? null;
  const lifespan = yNac || yDef ? `${yNac ?? "?"} – ${yDef ?? (p.viva === "si" ? "vive" : "?")}` : "";
  const metaTitle = isNew ? "Nueva persona · GENAIA" : `${fullName}${lifespan ? ` (${lifespan})` : ""} · GENAIA`;
  const metaDesc = isNew
    ? "Registra una nueva persona en tu árbol genealógico privado."
    : `Ficha genealógica de ${fullName}${lifespan ? `, ${lifespan}` : ""}${p.nacionalidad ? `, ${p.nacionalidad}` : ""}.`.slice(0, 160);

  return (
    <div>
      <Helmet>
        <title>{metaTitle.slice(0, 60)}</title>
        <meta name="description" content={metaDesc} />
        <meta property="og:title" content={metaTitle.slice(0, 60)} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:type" content="profile" />
        {p.foto_url && <meta property="og:image" content={p.foto_url} />}
        <link rel="canonical" href={`https://archivo-familiar-vivo.lovable.app/personas/${id}`} />
      </Helmet>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/personas")}><ArrowLeft className="h-4 w-4" /> Personas</Button>
        <Button variant="ghost" size="sm" onClick={() => navigate("/arbol")}><GitBranch className="h-4 w-4" /> Volver al árbol familiar</Button>
      </div>

      {!isNew && <PersonaHero p={p} />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {user && !editMode && !isNew && (
          <Button variant="outline" size="sm" onClick={() => setEditMode(true)}><Pencil className="h-4 w-4" /> Editar persona</Button>
        )}
        {user && (editMode || isNew) && (
          <Button size="sm" onClick={save} disabled={loading}><Save className="h-4 w-4" /> Guardar</Button>
        )}
        {!isNew && <Button size="sm" variant="secondary" onClick={async () => {
          const t = toast.loading("Investigando con IA…");
          try {
            const { data, error } = await supabase.functions.invoke("investigar-persona", { body: { person_id: id } });
            toast.dismiss(t);
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            toast.success(`${data.hipotesis_creadas} hipótesis · ${data.busquedas_creadas} búsquedas · ${data.tareas_creadas} tareas`);
          } catch (e: any) { toast.dismiss(t); toast.error(e.message ?? "Error"); }
        }}><Sparkles className="h-4 w-4" /> Investigar con IA</Button>}
        {!isNew && <Button size="sm" variant="secondary" onClick={async () => {
          const t = toast.loading("Generando hipótesis de contexto histórico…");
          try {
            const { data, error } = await supabase.functions.invoke("contexto-historico", { body: { person_id: id } });
            toast.dismiss(t);
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            toast.success(`${data.creadas ?? 0} hipótesis contextuales agregadas`);
          } catch (e: any) { toast.dismiss(t); toast.error(e.message ?? "Error"); }
        }}><Sparkles className="h-4 w-4" /> Contexto histórico</Button>}
        {!isNew && <Button size="sm" variant="secondary" onClick={async () => {
          const t = toast.loading("Escribiendo biografía con IA…");
          try {
            const { data, error } = await supabase.functions.invoke("biografia-auto", { body: { person_id: id } });
            toast.dismiss(t);
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            toast.success("Biografía generada y guardada en Notas");
            notify("Biografía generada", { body: `${p.nombres} ${p.apellidos}`, url: `/personas/${id}`, tag: `bio-${id}` });
            const { data: fresh } = await supabase.from("personas").select("*").eq("id", id!).maybeSingle();
            if (fresh) setP(fresh);
          } catch (e: any) { toast.dismiss(t); toast.error(e.message ?? "Error"); }
        }}><Sparkles className="h-4 w-4" /> Biografía automática</Button>}
        {!isNew && <Button size="sm" variant="secondary" onClick={async () => {
          const t = toast.loading("Buscando ascendientes con IA…");
          try {
            const { data, error } = await supabase.functions.invoke("investigar-auto", { body: { person_id: id, foco: "ascendientes" } });
            toast.dismiss(t);
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            const n = data.sugerencias_creadas ?? 0;
            toast.success(`${n} sugerencias de ascendientes`);
            if (n > 0) notify("Nuevas sugerencias de ascendientes", { body: `${n} para ${p.nombres} ${p.apellidos}`, url: `/personas/${id}`, tag: `asc-${id}` });
          } catch (e: any) { toast.dismiss(t); toast.error(e.message ?? "Error"); }
        }}><Sparkles className="h-4 w-4" /> Buscar ascendientes</Button>}
        {!isNew && <Button size="sm" variant="secondary" onClick={async () => {
          const t = toast.loading("Buscando descendientes con IA…");
          try {
            const { data, error } = await supabase.functions.invoke("investigar-auto", { body: { person_id: id, foco: "descendientes" } });
            toast.dismiss(t);
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            const n = data.sugerencias_creadas ?? 0;
            toast.success(`${n} sugerencias de descendientes`);
            if (n > 0) notify("Nuevas sugerencias de descendientes", { body: `${n} para ${p.nombres} ${p.apellidos}`, url: `/personas/${id}`, tag: `desc-${id}` });
          } catch (e: any) { toast.dismiss(t); toast.error(e.message ?? "Error"); }
        }}><Sparkles className="h-4 w-4" /> Buscar descendientes</Button>}
        {user && !isNew && editMode && <Button size="sm" variant="outline" onClick={eliminar}><Trash2 className="h-4 w-4" /> Eliminar</Button>}
        <Button size="sm" variant="ghost" onClick={() => navigate("/arbol")}><GitBranch className="h-4 w-4" /> Ver en árbol</Button>
      </div>

      {isNew && (
        <h1 className="mb-4 font-display text-3xl font-bold tracking-tight">Nueva persona</h1>
      )}

      <Tabs defaultValue="resumen">
        <TabsList className="flex flex-wrap h-auto glass-strong rounded-2xl p-1">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="familia">Familia</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="fotos">Fotos {fotos.length > 0 && <span className="ml-1 text-xs opacity-70">{fotos.length}</span>}</TabsTrigger>
          <TabsTrigger value="documentos">Documentos {docs.length > 0 && <span className="ml-1 text-xs opacity-70">{docs.length}</span>}</TabsTrigger>
          <TabsTrigger value="fuentes">Fuentes</TabsTrigger>
          <TabsTrigger value="investigacion">Investigación</TabsTrigger>
          <TabsTrigger value="coincidencias">Coincidencias {coincidencias.length > 0 && <span className="ml-1 text-xs opacity-70">{coincidencias.length}</span>}</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          {!isNew && (
            <Card className="archivo-card mb-3">
              <CardHeader className="pb-2 text-center"><CardTitle className="font-serif text-lg">Datos vitales</CardTitle></CardHeader>
              <CardContent className="mx-auto grid max-w-3xl gap-x-6 gap-y-3 text-center text-sm sm:grid-cols-2">
                <Field label="Nombres" value={p.nombres} />
                <Field label="Apellidos" value={p.apellidos} />
                <Field label="Sexo" value={p.sexo} />
                <Field label="Nacionalidad" value={p.nacionalidad} />
                <Field label="Nacimiento" value={fmtDate(p.nac_fecha) ?? p.nac_fecha_aprox} />
                <Field label="Defunción" value={fmtDate(p.defuncion_fecha) ?? (p.viva === "si" ? "Vive" : null)} />
                <Field label="Bautismo" value={fmtDate(p.bautismo_fecha)} />
                <Field label="Matrimonio" value={fmtDate(p.matrimonio_fecha)} />
                <Field label="Ocupación" value={p.ocupacion} />
                <Field label="Religión" value={p.religion} />
              </CardContent>
            </Card>
          )}
          {(editMode || isNew) && (
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
            <div><Label>Lugar de nacimiento</Label>
              <LugarSelect value={p.nac_lugar_id} onChange={(v) => set("nac_lugar_id", v)} lugares={lugares} onLugaresChange={setLugares} /></div>
            <div><Label>Fecha aprox. nacimiento</Label><Input value={p.nac_fecha_aprox ?? ""} onChange={(e) => set("nac_fecha_aprox", e.target.value)} placeholder="hacia 1880" /></div>
            <div><Label>Rango de nacimiento (años)</Label>
              <div className="flex gap-2"><Input type="number" placeholder="desde" value={p.nac_rango_ini ?? ""} onChange={(e) => set("nac_rango_ini", e.target.value ? parseInt(e.target.value) : null)} />
                <Input type="number" placeholder="hasta" value={p.nac_rango_fin ?? ""} onChange={(e) => set("nac_rango_fin", e.target.value ? parseInt(e.target.value) : null)} /></div></div>
            <div><Label>Fecha de bautismo</Label><Input type="date" value={p.bautismo_fecha ?? ""} onChange={(e) => set("bautismo_fecha", e.target.value || null)} /></div>
            <div><Label>Lugar de bautismo</Label>
              <LugarSelect value={p.bautismo_lugar_id} onChange={(v) => set("bautismo_lugar_id", v)} lugares={lugares} onLugaresChange={setLugares} /></div>
            <div><Label>Fecha de matrimonio</Label><Input type="date" value={p.matrimonio_fecha ?? ""} onChange={(e) => set("matrimonio_fecha", e.target.value || null)} /></div>
            <div><Label>Lugar de matrimonio</Label>
              <LugarSelect value={p.matrimonio_lugar_id} onChange={(v) => set("matrimonio_lugar_id", v)} lugares={lugares} onLugaresChange={setLugares} /></div>
            <div><Label>Fecha de defunción</Label><Input type="date" value={p.defuncion_fecha ?? ""} onChange={(e) => set("defuncion_fecha", e.target.value || null)} /></div>
            <div><Label>Lugar de defunción</Label>
              <LugarSelect value={p.defuncion_lugar_id} onChange={(v) => set("defuncion_lugar_id", v)} lugares={lugares} onLugaresChange={setLugares} /></div>
            <div><Label>Fecha de entierro</Label><Input type="date" value={p.entierro_fecha ?? ""} onChange={(e) => set("entierro_fecha", e.target.value || null)} /></div>
            <div><Label>Lugar de entierro</Label>
              <LugarSelect value={p.entierro_lugar_id} onChange={(v) => set("entierro_lugar_id", v)} lugares={lugares} onLugaresChange={setLugares} /></div>
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
          )}
        </TabsContent>

        <TabsContent value="familia">
          <RelacionesPanel personaId={id!} relaciones={relaciones} allPersonas={allPersonas} reload={async () => {
            const { data } = await supabase.from("relaciones").select("*, pariente:personas!relaciones_pariente_id_fkey(*)").or(`persona_id.eq.${id},pariente_id.eq.${id}`);
            setRelaciones(data ?? []);
          }} disabled={isNew} />
        </TabsContent>

        <TabsContent value="fotos">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Fotos en las que aparece esta persona.</p>
            <div className="flex items-center gap-2">
              <input
                id="upload-foto-persona"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !id || isNew) return;
                  const t = toast.loading("Subiendo foto…");
                  try {
                    const u = (await supabase.auth.getUser()).data.user!;
                    const ext = file.name.split(".").pop();
                    const path = `${u.id}/${crypto.randomUUID()}.${ext}`;
                    const { error: upErr } = await supabase.storage.from("fotos").upload(path, file);
                    if (upErr) throw upErr;
                    const { data: { publicUrl } } = supabase.storage.from("fotos").getPublicUrl(path);
                    const { error: insErr } = await supabase.from("fotos").insert({
                      user_id: u.id, url: publicUrl, storage_path: path,
                      titulo: `${p.nombres} ${p.apellidos}`,
                      personas_ids: [id],
                    });
                    if (insErr) throw insErr;
                    const { data: ft } = await supabase.from("fotos").select("*").contains("personas_ids", [id]).order("created_at", { ascending: false });
                    setFotos(ft ?? []);
                    toast.dismiss(t); toast.success("Foto agregada");
                  } catch (err: any) { toast.dismiss(t); toast.error(err.message ?? "Error al subir"); }
                  e.target.value = "";
                }}
              />
              <Button asChild size="sm" variant="default" disabled={isNew}>
                <label htmlFor="upload-foto-persona" className="cursor-pointer">+ Subir foto</label>
              </Button>
              {fotos.length > 0 && (
                <Button size="sm" variant="outline" onClick={async () => {
                  toast.message(`Analizando ${fotos.length} foto(s)…`);
                  let ok = 0;
                  for (const f of fotos) {
                    const { error } = await supabase.functions.invoke("analizar-rostro", { body: { persona_id: id, foto_url: f.url, foto_id: f.id } });
                    if (!error) ok++;
                  }
                  toast.success(`Analizadas ${ok}/${fotos.length}. Revisa en Rasgos & Parecidos.`);
                }}>
                  <Sparkles className="mr-1 h-3.5 w-3.5" /> Analizar todas
                </Button>
              )}
            </div>
          </div>
          {fotos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin fotos vinculadas todavía. Sube la primera con el botón de arriba.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {fotos.map((f: any) => (
                <div key={f.id} className="glass overflow-hidden rounded-2xl">
                  <div className="aspect-square overflow-hidden">
                    <img src={f.url} alt={f.titulo ?? ""} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className="space-y-1 p-2">
                    {f.titulo && <p className="truncate text-xs font-medium">{f.titulo}</p>}
                    {f.fecha_aprox && <p className="truncate text-[10px] text-muted-foreground">{f.fecha_aprox}</p>}
                    <Button size="sm" variant="ghost" className="h-7 w-full text-[11px]" onClick={async () => {
                      const { error } = await supabase.functions.invoke("analizar-rostro", { body: { persona_id: id, foto_url: f.url, foto_id: f.id } });
                      if (error) toast.error(error.message); else toast.success("Rasgos extraídos");
                    }}>
                      <Sparkles className="mr-1 h-3 w-3" /> Analizar rasgos
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>


        <TabsContent value="documentos">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Documentos en los que aparece esta persona (actas, censos, padrones, fotos escaneadas).
            </p>
            <Button asChild size="sm" variant="outline">
              <Link to="/importar"><Sparkles className="mr-1 h-3.5 w-3.5" /> Subir documento y leerlo con IA</Link>
            </Button>
          </div>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin documentos vinculados todavía.</p>
          ) : (
            <ul className="grid gap-2">
              {docs.map((d: any) => (
                <li key={d.id} className="archivo-card px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/documentos`} className="font-medium hover:text-primary truncate block">{d.titulo}</Link>
                      <div className="text-xs text-muted-foreground">{d.tipo} · {d.fecha ?? "s/f"} · {d.estado}</div>
                      {d.resumen && <p className="mt-1 text-xs line-clamp-2">{d.resumen}</p>}
                    </div>
                    {d.url && (
                      <Button asChild size="sm" variant="ghost">
                        <a href={d.url} target="_blank" rel="noreferrer">Ver</a>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="coincidencias">
          {coincidencias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin coincidencias detectadas para esta persona.</p>
          ) : (
            <ul className="grid gap-2">
              {coincidencias.map((c: any) => {
                const otraId = c.ref_a === id ? c.ref_b : c.ref_a;
                const otra = allPersonas.find((x: any) => x.id === otraId);
                return (
                  <li key={c.id} className="archivo-card px-4 py-3">
                    <div className="flex items-center justify-between">
                      <Link to={`/personas/${otraId}`} className="font-medium hover:text-primary">
                        {otra ? `${otra.nombres} ${otra.apellidos}` : otraId}
                      </Link>
                      <span className="archivo-chip">Score {c.score}/100 · {c.estado}</span>
                    </div>
                    {Array.isArray(c.razones) && c.razones.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">{c.razones.join(" · ")}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="investigacion">
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Búsquedas externas sugeridas</h3>
              <BusquedasSugeridas persona={p} disabled={isNew} />
            </div>
            <div>
              <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Hipótesis</h3>
              {hipos.length === 0 ? <p className="text-sm text-muted-foreground">Sin hipótesis vinculadas.</p> :
                <ul className="grid gap-2">{hipos.map((h) => (
                  <li key={h.id} className="archivo-card px-4 py-3"><div className="font-medium">{h.titulo}</div>
                    <div className="text-xs text-muted-foreground">Estado: {h.estado} · Probabilidad: {h.probabilidad}%</div></li>
                ))}</ul>}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Inferencias</h3>
                <Button size="sm" variant="outline" onClick={recalcularInferencias} disabled={isNew}>Recalcular</Button>
              </div>
              <Card className="archivo-card mb-2 border-accent/30 bg-accent/5">
                <CardContent className="flex items-start gap-3 pt-4 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <p>Información inferida automáticamente. No comprobada hasta asociar fuente documental.</p>
                </CardContent>
              </Card>
              {inferences.length === 0 ? <p className="text-sm text-muted-foreground">Sin inferencias.</p> :
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
            </div>
          </div>
        </TabsContent>

        <TabsContent value="fuentes">
          <p className="mb-3 text-sm text-muted-foreground">
            Fuentes citadas para los datos vitales (eventos) de esta persona. Cada evento puede tener una fuente asociada.
          </p>
          {(() => {
            const conFuente = eventos.filter((e: any) => e.fuente_id);
            const sinFuente = eventos.filter((e: any) => !e.fuente_id);
            return (
              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Eventos con fuente ({conFuente.length})</h4>
                  {conFuente.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay eventos con fuente documental.</p> :
                    <ul className="grid gap-2">{conFuente.map((e: any) => {
                      const d = docs.find((x: any) => x.id === e.fuente_id);
                      return (
                        <li key={e.id} className="archivo-card px-4 py-3">
                          <div className="font-medium">{e.tipo} · {e.fecha ?? e.fecha_aprox ?? "s/f"}</div>
                          <div className="text-xs text-muted-foreground">Fuente: {d?.titulo ?? "documento sin título"}</div>
                        </li>
                      );
                    })}</ul>}
                </div>
                {sinFuente.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Eventos sin fuente ({sinFuente.length})</h4>
                    <ul className="grid gap-2">{sinFuente.map((e: any) => (
                      <li key={e.id} className="archivo-card px-4 py-3 flex items-center justify-between">
                        <span className="text-sm">{e.tipo} · {e.fecha ?? e.fecha_aprox ?? "s/f"}</span>
                        <span className="archivo-chip">Sin fuente</span>
                      </li>
                    ))}</ul>
                  </div>
                )}
                {docs.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Todos los documentos vinculados ({docs.length})</h4>
                    <ul className="grid gap-2">{docs.map((d: any) => (
                      <li key={d.id} className="archivo-card px-4 py-3">
                        <div className="font-medium">{d.titulo}</div>
                        <div className="text-xs text-muted-foreground">{d.cita ?? d.repositorio ?? d.tipo}</div>
                      </li>
                    ))}</ul>
                  </div>
                )}
              </div>
            );
          })()}
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

function RelacionesPanel({ personaId, personaSexo, relaciones, allPersonas, reload, disabled }: any) {
  const [tipo, setTipo] = useState("padre");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<any | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (allPersonas || [])
      .filter((x: any) => x.id !== personaId)
      .filter((x: any) => {
        const name = `${x.nombres ?? ""} ${x.apellidos ?? ""}`.toLowerCase();
        return name.includes(q) || matchesCode(query, x.id);
      })
      .slice(0, 8);
  }, [allPersonas, query, personaId]);

  const add = async () => {
    if (!picked) return;
    const user = (await supabase.auth.getUser()).data.user!;
    const { error } = await supabase.from("relaciones").insert({ user_id: user.id, persona_id: personaId, pariente_id: picked.id, tipo: tipo as any });
    if (error) return toast.error(error.message);
    const inv = tipo === "padre" || tipo === "madre" ? "hijo"
      : tipo === "hijo" ? (personaSexo === "femenino" ? "madre" : "padre")
      : tipo === "conyuge" ? "conyuge"
      : tipo === "hermano" ? "hermano" : null;
    if (inv) {
      await supabase.from("relaciones").insert({ user_id: user.id, persona_id: picked.id, pariente_id: personaId, tipo: inv as any });
    }
    setQuery(""); setPicked(null); reload();
  };
  const del = async (rid: string) => { await supabase.from("relaciones").delete().eq("id", rid); reload(); };

  // Normaliza: una línea por OTRO pariente, desde la perspectiva de la persona actual.
  const view = useMemo(() => {
    const out = new Map<string, { id: string; tipo: string; other: any }>();
    const labelInv = (t: string, otherSex?: string | null) =>
      t === "padre" || t === "madre" ? "hijo"
      : t === "hijo" ? (otherSex === "femenino" ? "madre" : "padre")
      : t;
    for (const r of relaciones || []) {
      let other: any = null; let t = r.tipo as string;
      if (r.persona_id === personaId) {
        other = r.pariente ?? allPersonas.find((x: any) => x.id === r.pariente_id);
      } else if (r.pariente_id === personaId) {
        other = allPersonas.find((x: any) => x.id === r.persona_id);
        t = labelInv(r.tipo, other?.sexo);
      } else continue;
      if (!other || other.id === personaId) continue;
      const key = `${other.id}:${t}`;
      if (!out.has(key)) out.set(key, { id: r.id, tipo: t, other });
    }
    return Array.from(out.values());
  }, [relaciones, personaId, allPersonas]);

  if (disabled) return <p className="text-sm text-muted-foreground">Guarda la persona primero para añadir relaciones.</p>;
  return (
    <Card className="archivo-card"><CardContent className="space-y-4 pt-6">
      <div className="flex flex-wrap gap-2">
        <QuickAddRelative personaId={personaId} personaSexo={personaSexo} defaultTipo="padre" onAdded={reload} trigger={<Button size="sm" variant="outline">+ Padre</Button>} />
        <QuickAddRelative personaId={personaId} personaSexo={personaSexo} defaultTipo="madre" onAdded={reload} trigger={<Button size="sm" variant="outline">+ Madre</Button>} />
        <QuickAddRelative personaId={personaId} personaSexo={personaSexo} defaultTipo="conyuge" onAdded={reload} trigger={<Button size="sm" variant="outline">+ Cónyuge</Button>} />
        <QuickAddRelative personaId={personaId} personaSexo={personaSexo} defaultTipo="hijo" onAdded={reload} trigger={<Button size="sm" variant="outline">+ Hijo/a</Button>} />
        <QuickAddRelative personaId={personaId} personaSexo={personaSexo} defaultTipo="hermano" onAdded={reload} trigger={<Button size="sm" variant="outline">+ Hermano/a</Button>} />
      </div>
      <div className="border-t border-border pt-4">
        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Vincular persona ya existente</p>
        <div className="grid gap-2 md:grid-cols-[160px,1fr,auto]">
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="padre">Padre</SelectItem><SelectItem value="madre">Madre</SelectItem>
              <SelectItem value="conyuge">Cónyuge</SelectItem><SelectItem value="hijo">Hijo/a</SelectItem>
              <SelectItem value="hermano">Hermano/a</SelectItem><SelectItem value="otro">Otro</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Input
              value={picked ? `${picked.nombres} ${picked.apellidos}` : query}
              onChange={(e) => { setPicked(null); setQuery(e.target.value); }}
              placeholder="Buscar por nombre o código (ej. GDVB-TS5)…"
            />
            {!picked && matches.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-popover text-sm shadow-lg">
                {matches.map((m: any) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => { setPicked(m); setQuery(""); }}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-accent">
                      <span className="truncate">{m.nombres} {m.apellidos}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{personaCode(m.id)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button onClick={add} disabled={!picked}>Vincular</Button>
        </div>
      </div>
      <ul className="divide-y divide-border">{view.map((r) => (
        <li key={r.id + r.other.id} className="flex items-center justify-between py-2 text-sm">
          <span>
            <strong className="capitalize">{r.tipo}</strong>:{" "}
            <Link to={`/personas/${r.other.id}`} className="hover:text-primary">{r.other.nombres} {r.other.apellidos}</Link>
            <span className="ml-2 font-mono text-[10px] text-muted-foreground">{personaCode(r.other.id)}</span>
          </span>
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

type AgentDef = { key: string; label: string; fn: string; body: Record<string, unknown> };
type AgentState = { status: "idle" | "running" | "done" | "error"; ms?: number; result?: any; error?: string };

function BusquedasSugeridas({ persona, disabled }: any) {
  if (disabled) return <p className="text-sm text-muted-foreground">Guarda la persona primero.</p>;
  const sugs = generateExternalSearches(persona);
  const [running, setRunning] = useState(false);

  const agents: AgentDef[] = [
    { key: "advanced",  label: "Búsqueda avanzada (filtros + variantes)", fn: "buscar-externo-auto", body: { persona_id: persona.id, modo: "advanced" } },
    { key: "broad",     label: "Búsqueda libre (sin filtros)",            fn: "buscar-externo-auto", body: { persona_id: persona.id, modo: "broad" } },
    { key: "ia",        label: "IA: hipótesis y sugerencias",             fn: "investigar-auto",     body: { person_id: persona.id } },
    { key: "asc",       label: "IA: ascendientes",                        fn: "investigar-auto",     body: { person_id: persona.id, foco: "ascendientes" } },
    { key: "desc",      label: "IA: descendientes",                       fn: "investigar-auto",     body: { person_id: persona.id, foco: "descendientes" } },
  ];

  const initial: Record<string, AgentState> = Object.fromEntries(agents.map((a) => [a.key, { status: "idle" as const }]));
  const [states, setStates] = useState<Record<string, AgentState>>(initial);

  const auto = async () => {
    setRunning(true);
    setStates(Object.fromEntries(agents.map((a) => [a.key, { status: "running" as const }])));
    toast.info("Lanzando 5 agentes en paralelo…");

    let totalSug = 0, totalHip = 0, ok = 0;

    await Promise.all(agents.map(async (a) => {
      const t0 = Date.now();
      try {
        const { data, error } = await supabase.functions.invoke(a.fn, { body: a.body });
        const ms = Date.now() - t0;
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        ok++;
        totalSug += data?.sugerencias ?? data?.sugerencias_creadas ?? 0;
        totalHip += data?.hipotesis_creadas ?? 0;
        setStates((s) => ({ ...s, [a.key]: { status: "done", ms, result: data } }));
      } catch (e: any) {
        setStates((s) => ({ ...s, [a.key]: { status: "error", ms: Date.now() - t0, error: e.message ?? String(e) } }));
      }
    }));

    setRunning(false);
    toast.success(`${ok}/5 agentes · ${totalSug} sugerencias · ${totalHip} hipótesis.`);
  };

  const dot = (s: AgentState["status"]) =>
    s === "running" ? "bg-primary animate-pulse" :
    s === "done"    ? "bg-emerald-500" :
    s === "error"   ? "bg-destructive" :
                      "bg-muted-foreground/30";

  const totals = Object.values(states);
  const doneCount = totals.filter((t) => t.status === "done").length;
  const errCount = totals.filter((t) => t.status === "error").length;
  const progress = ((doneCount + errCount) / agents.length) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">{running ? `Progreso ${doneCount + errCount}/5` : "5 agentes paralelos"}</div>
        <Button size="sm" onClick={auto} disabled={running}>
          <Sparkles className="h-4 w-4" /> {running ? "Buscando…" : "Mega-buscador (5 agentes)"}
        </Button>
      </div>

      {(running || doneCount + errCount > 0) && (
        <div className="space-y-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {agents.map((a) => {
              const st = states[a.key];
              const sumario = st.result
                ? `${st.result.sugerencias ?? st.result.sugerencias_creadas ?? 0} sug · ${st.result.hipotesis_creadas ?? 0} hip`
                : st.status === "error" ? (st.error ?? "error")
                : st.status === "running" ? "ejecutando…"
                : "en espera";
              return (
                <li key={a.key} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 px-3 py-2 text-xs">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${dot(st.status)}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{a.label}</div>
                    <div className="truncate text-muted-foreground">{sumario}</div>
                  </div>
                  {st.ms != null && <span className="shrink-0 tabular-nums text-muted-foreground">{(st.ms / 1000).toFixed(1)}s</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

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
    </div>
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

function Field({ label, value }: { label: string; value: any }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5">{empty ? ND : value}</div>
    </div>
  );
}

function FamilyList({ label, people, onClick }: { label: string; people: any[]; onClick: (id: string) => void }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      {people.length === 0 ? (
        <div className="mt-0.5">{ND}</div>
      ) : (
        <ul className="mt-1 space-y-1">
          {people.map((x) => (
            <li key={x.id}>
              <button onClick={() => onClick(x.id)} className="text-left text-link underline-offset-2 hover:underline">
                {x.nombres} {x.apellidos}
                {x.nac_fecha || x.defuncion_fecha ? (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({yearOf(x.nac_fecha) ?? "?"}–{yearOf(x.defuncion_fecha) ?? (x.viva === "si" ? "vive" : "?")})
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
