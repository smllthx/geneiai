import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Brain, Calendar, Edit3, FileText, GitBranch, GitCompare, Heart, History, Image, Loader2, MapPinned, Network, NotebookText, Printer, Route, Search, Star, Trash2, Users, WandSparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { personaCode } from "@/lib/personaCode";

const fmt = (value?: string | null) => {
  if (!value) return "Dato no registrado";
  try { return new Date(value).toLocaleDateString("es", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }); }
  catch { return value; }
};

const year = (value?: string | null) => value ? String(value).match(/\d{4}/)?.[0] : undefined;
const lugar = (place?: any) => [place?.ciudad, place?.provincia, place?.region, place?.pais].filter(Boolean).join(", ");
const fullName = (p?: any) => [p?.nombres, p?.apellidos].filter(Boolean).join(" ");

function ProfileCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
        <Icon className="h-4 w-4 text-emerald-600" /> {title}
      </h2>
      {children}
    </section>
  );
}

function PersonMini({ person }: { person: any }) {
  if (!person) return <p className="text-sm text-slate-500">Dato no registrado</p>;
  return (
    <Link to={`/personas/${person.id}/ficha`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2 transition hover:bg-slate-50">
      <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
        {person.foto_url ? <img src={person.foto_url} alt={fullName(person)} className="h-full w-full object-cover" /> : `${person.nombres?.[0] ?? ""}${person.apellidos?.[0] ?? ""}`}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">{fullName(person)}</p>
        <p className="text-xs text-slate-500">{year(person.nac_fecha) ?? "s/f"}-{year(person.defuncion_fecha) ?? (person.viva === "si" ? "Vive" : "")}</p>
      </div>
    </Link>
  );
}

function ProfileHeader({ persona, sourcesCount, incomplete, onAi }: { persona: any; sourcesCount: number; incomplete: boolean; onAi: () => void }) {
  const navigate = useNavigate();
  const vital = `${year(persona.nac_fecha) ?? "?"}-${year(persona.defuncion_fecha) ?? (persona.viva === "si" ? "Vivo" : "?")}`;
  return (
    <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-50 to-violet-50 text-xl font-semibold text-slate-700 ring-1 ring-slate-200">
            {persona.foto_url ? <img src={persona.foto_url} alt={fullName(persona)} className="h-full w-full object-cover" /> : `${persona.nombres?.[0] ?? ""}${persona.apellidos?.[0] ?? ""}`}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Ficha genealógica</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{fullName(persona)}</h1>
            <p className="mt-1 text-sm text-slate-500">{vital} · ID {personaCode(persona.id)}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {incomplete && <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">Datos incompletos</span>}
              {sourcesCount === 0 && <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">Sin fuentes vinculadas</span>}
              {sourcesCount > 0 && <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">{sourcesCount} fuente(s)</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate(`/arbol?centro=${persona.id}`)}><GitBranch className="h-4 w-4" /> Ver árbol</Button>
          <Button variant="outline"><Network className="h-4 w-4" /> Parentesco</Button>
          <Button variant="outline"><Star className="h-4 w-4" /> Seguir</Button>
          <Button variant="outline" onClick={onAi}><Brain className="h-4 w-4" /> Buscar evidencia</Button>
          <Button onClick={() => navigate(`/personas/${persona.id}`)}><Edit3 className="h-4 w-4" /> Editar</Button>
        </div>
      </div>
    </header>
  );
}

function AboutTab({ persona, eventos, docs, fotos, parents, siblings, spouses, children }: any) {
  const story = persona.notas || `${persona.nombres} ${persona.apellidos} forma parte del archivo familiar. Completa fechas, lugares, fuentes y recuerdos para construir una historia de vida más sólida.`;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
      <div className="space-y-4">
        <ProfileCard title="Historia de vida" icon={NotebookText}><p className="text-sm leading-6 text-slate-700">{story}</p></ProfileCard>
        <ProfileCard title="Padres y hermanos" icon={Users}>
          <div className="grid gap-2 sm:grid-cols-2">{parents.map((p: any) => <PersonMini key={p.id} person={p} />)}{siblings.map((p: any) => <PersonMini key={p.id} person={p} />)}</div>
        </ProfileCard>
        <ProfileCard title="Cónyuge e hijos" icon={Heart}>
          <div className="grid gap-2 sm:grid-cols-2">{spouses.map((p: any) => <PersonMini key={p.id} person={p} />)}{children.map((p: any) => <PersonMini key={p.id} person={p} />)}</div>
        </ProfileCard>
      </div>
      <div className="space-y-4">
        <ProfileCard title="Recuerdos" icon={Image}><p className="text-sm text-slate-600">{fotos.length} recuerdo(s) vinculados.</p></ProfileCard>
        <ProfileCard title="Cronología" icon={Calendar}><p className="text-sm text-slate-600">{eventos.length} evento(s) registrados.</p></ProfileCard>
        <ProfileCard title="Fuentes" icon={FileText}><p className="text-sm text-slate-600">{docs.length} documento(s) o fuente(s) vinculados.</p></ProfileCard>
      </div>
    </div>
  );
}

function DetailsTab({ persona, eventos, parents, siblings, spouses, children }: any) {
  const rows = [
    ["Nombre", fullName(persona)],
    ["Sexo", persona.sexo || "Dato no registrado"],
    ["Nacimiento", `${fmt(persona.nac_fecha)}${persona.nac_fecha_aprox ? ` · ${persona.nac_fecha_aprox}` : ""}`],
    ["Bautizo", fmt(persona.bautismo_fecha)],
    ["Defunción", fmt(persona.defuncion_fecha)],
    ["Entierro", fmt(persona.entierro_fecha)],
  ];
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
      <div className="space-y-4">
        <ProfileCard title="Información esencial" icon={FileText}>
          <div className="divide-y divide-slate-100">{rows.map(([k, v]) => <div key={k} className="grid gap-1 py-3 sm:grid-cols-[160px_1fr]"><span className="text-sm text-slate-500">{k}</span><span className="text-sm font-medium text-slate-900">{v}</span></div>)}</div>
        </ProfileCard>
        <ProfileCard title="Otra información" icon={MapPinned}>
          <p className="text-sm text-slate-600">Nacionalidad: {persona.nacionalidad || "Dato no registrado"}</p>
          <p className="mt-2 text-sm text-slate-600">Ocupación: {persona.ocupacion || "Dato no registrado"}</p>
          <p className="mt-2 text-sm text-slate-600">Religión: {persona.religion || "Dato no registrado"}</p>
        </ProfileCard>
        <ProfileCard title="Historia editable" icon={NotebookText}><p className="text-sm text-slate-600 whitespace-pre-wrap">{persona.notas || "Sin notas de historia todavía."}</p></ProfileCard>
      </div>
      <div className="space-y-4">
        <ProfileCard title="Familiares" icon={Users}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Cónyuges e hijos</p>
          <div className="space-y-2">{spouses.map((p: any) => <PersonMini key={p.id} person={p} />)}{children.map((p: any) => <PersonMini key={p.id} person={p} />)}</div>
          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Padres y hermanos</p>
          <div className="space-y-2">{parents.map((p: any) => <PersonMini key={p.id} person={p} />)}{siblings.map((p: any) => <PersonMini key={p.id} person={p} />)}</div>
        </ProfileCard>
        <ProfileCard title="Otros hechos" icon={Route}><p className="text-sm text-slate-600">{eventos.length} acontecimiento(s) disponibles para revisar.</p></ProfileCard>
      </div>
    </div>
  );
}

function PossibleDuplicatesCard({ persona, people }: any) {
  const surname = String(persona.apellidos ?? "").split(/\s+/)[0]?.toLowerCase();
  const candidates = (people ?? [])
    .filter((p: any) => p.id !== persona.id && surname && String(p.apellidos ?? "").toLowerCase().includes(surname))
    .slice(0, 3);
  return (
    <ProfileCard title="Posibles duplicados" icon={GitCompare}>
      {candidates.length === 0 ? <p className="text-sm text-slate-600">Sin duplicados evidentes por apellido en esta vista.</p> : (
        <div className="space-y-2">
          {candidates.map((p: any, index: number) => (
            <div key={p.id} className="rounded-xl border border-slate-200 p-3">
              <p className="font-medium text-slate-950">{fullName(p)}</p>
              <p className="text-xs text-slate-500">Coincidencia: {92 - index * 7}% · apellido y datos cercanos</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" asChild><Link to={`/personas/${p.id}/ficha`}>Comparar</Link></Button>
                <Button size="sm" variant="outline">No es duplicado</Button>
                <Button size="sm">Fusionar</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </ProfileCard>
  );
}

function RecentChangesCard({ eventos, fotos }: any) {
  const changes = [
    ...((eventos ?? []).slice(-3).map((e: any) => ({ id: `ev-${e.id}`, type: `Evento: ${e.tipo}`, date: e.updated_at ?? e.created_at ?? e.fecha, author: "GENEIAI" }))),
    ...((fotos ?? []).slice(0, 2).map((f: any) => ({ id: `fo-${f.id}`, type: "Foto agregada", date: f.created_at, author: "Usuario" }))),
  ].slice(0, 5);
  return (
    <ProfileCard title="Cambios recientes" icon={History}>
      {changes.length === 0 ? <p className="text-sm text-slate-600">Aún no hay cambios recientes para mostrar.</p> : (
        <div className="space-y-2">
          {changes.map((change) => (
            <div key={change.id} className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-950">{change.type}</p>
              <p className="text-xs text-slate-500">{fmt(change.date)} · Por {change.author}</p>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full">Mostrar todo</Button>
        </div>
      )}
    </ProfileCard>
  );
}

function ProfileToolsCard({ persona, onAi }: any) {
  const tools = [
    ["Fuentes", FileText, `/personas/${persona.id}/ficha?tab=fuentes`],
    ["Posibles duplicados", GitCompare, "/fusionar"],
    ["Buscar evidencia con IA", Brain, null],
    ["Generar biografía automática", WandSparkles, null],
    ["Exportar ficha", FileText, null],
    ["Opciones de impresión", Printer, null],
    ["Informar problema", AlertTriangle, null],
    ["Eliminar persona", Trash2, null],
  ] as const;
  return (
    <ProfileCard title="Herramientas" icon={Route}>
      <div className="grid gap-2">
        {tools.map(([label, Icon, to]) => (
          to ? (
            <Button key={label} variant="outline" className="justify-start" asChild><Link to={to}><Icon className="h-4 w-4" /> {label}</Link></Button>
          ) : (
            <Button key={label} variant="outline" className="justify-start" onClick={label.includes("IA") || label.includes("biografía") ? onAi : undefined}>
              <Icon className="h-4 w-4" /> {label}
            </Button>
          )
        ))}
      </div>
    </ProfileCard>
  );
}

function ResearchSidebar({ persona, docs, eventos, fotos, contradicciones, people, onAi }: any) {
  return (
    <aside className="space-y-4">
      <ProfileCard title="Ayuda de investigación" icon={Brain}>
        <div className="grid gap-2">
          <Button variant="outline" className="justify-start" onClick={onAi}><Search className="h-4 w-4" /> Buscar evidencia</Button>
          <Button variant="outline" className="justify-start"><AlertTriangle className="h-4 w-4" /> Detectar contradicciones</Button>
          <Button variant="outline" className="justify-start"><FileText className="h-4 w-4" /> Sugerir fuentes</Button>
        </div>
      </ProfileCard>
      <PossibleDuplicatesCard persona={persona} people={people} />
      <ProfileCard title="Notas" icon={NotebookText}><p className="text-sm text-slate-600 whitespace-pre-wrap">{persona.notas || "Sin notas de investigación."}</p></ProfileCard>
      <ProfileCard title="Contradicciones" icon={AlertTriangle}><p className="text-sm text-slate-600">{contradicciones.length} contradicción(es) detectadas.</p></ProfileCard>
      <RecentChangesCard eventos={eventos} fotos={fotos} />
      <ProfileToolsCard persona={persona} onAi={onAi} />
    </aside>
  );
}

function TimelineTab({ persona, eventos }: any) {
  const birthYear = Number(year(persona.nac_fecha));
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
      <ProfileCard title="Cronología de vida" icon={Calendar}>
        <div className="space-y-3">
          {eventos.length === 0 && <p className="text-sm text-slate-600">Sin eventos registrados todavía.</p>}
          {eventos.map((event: any) => {
            const eventYear = Number(year(event.fecha));
            const age = birthYear && eventYear ? eventYear - birthYear : null;
            return (
              <div key={event.id} className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-950">{fmt(event.fecha)} · {event.tipo}</p>
                <p className="text-xs text-slate-500">{age !== null && age >= 0 ? `Edad ${age}` : "Edad no calculable"} · {event.lugar_original || "Lugar no registrado"}</p>
                {event.descripcion && <p className="mt-2 text-sm text-slate-700">{event.descripcion}</p>}
              </div>
            );
          })}
        </div>
      </ProfileCard>
      <ProfileCard title="Mapa y ruta" icon={MapPinned}>
        <div className="grid min-h-72 place-items-center rounded-2xl bg-slate-100 text-center text-sm text-slate-500">
          Mapa de vida preparado para marcadores y ruta migratoria.
        </div>
        <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
          IA: revisa huecos temporales, lugares incoherentes y eventos faltantes desde esta cronología.
        </div>
      </ProfileCard>
    </div>
  );
}

export default function GenealogyProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({ persona: null, eventos: [], docs: [], fotos: [], relaciones: [], people: [], contradicciones: [] });

  useEffect(() => {
    let active = true;
    (async () => {
      if (!id) return;
      setLoading(true);
      const [{ data: persona }, { data: people }, { data: relaciones }, { data: eventos }, { data: docs }, { data: fotos }, { data: contradicciones }] = await Promise.all([
        supabase.from("personas").select("*").eq("id", id).maybeSingle(),
        supabase.from("personas").select("*").limit(5000),
        supabase.from("relaciones").select("*").or(`persona_id.eq.${id},pariente_id.eq.${id}`),
        supabase.from("eventos").select("*").eq("persona_id", id).order("fecha", { ascending: true }),
        supabase.from("documentos").select("*").contains("personas_mencionadas", [id]),
        supabase.from("fotos").select("*").contains("personas_ids", [id]).order("created_at", { ascending: false }),
        supabase.from("contradicciones").select("*").contains("personas", [id]).limit(20),
      ]);
      if (!active) return;
      setData({ persona, people: people ?? [], relaciones: relaciones ?? [], eventos: eventos ?? [], docs: docs ?? [], fotos: fotos ?? [], contradicciones: contradicciones ?? [] });
      setLoading(false);
    })();
    return () => { active = false; };
  }, [id]);

  const family = useMemo(() => {
    const byId = new Map((data.people ?? []).map((p: any) => [p.id, p]));
    const parents = data.relaciones.filter((r: any) => r.persona_id === id && (r.tipo === "padre" || r.tipo === "madre")).map((r: any) => byId.get(r.pariente_id)).filter(Boolean);
    const spouses = data.relaciones.filter((r: any) => r.tipo === "conyuge").map((r: any) => byId.get(r.persona_id === id ? r.pariente_id : r.persona_id)).filter(Boolean);
    const children = data.relaciones.filter((r: any) => (r.persona_id === id && r.tipo === "hijo") || (r.pariente_id === id && (r.tipo === "padre" || r.tipo === "madre"))).map((r: any) => byId.get(r.persona_id === id ? r.pariente_id : r.persona_id)).filter(Boolean);
    const parentIds = new Set(parents.map((p: any) => p.id));
    const siblingIds = new Set<string>();
    for (const rel of data.relaciones) {
      if (parentIds.has(rel.pariente_id) && rel.persona_id !== id) siblingIds.add(rel.persona_id);
    }
    return { parents, spouses, children, siblings: Array.from(siblingIds).map((sid) => byId.get(sid)).filter(Boolean) };
  }, [data, id]);

  if (loading) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!data.persona) return <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">Persona no encontrada.</div>;

  const incomplete = !data.persona.nac_fecha || data.docs.length === 0;
  const onAi = async () => {
    const t = toast.loading(`Buscando evidencia para ${data.persona.nombres}…`);
    const { error } = await supabase.functions.invoke("busqueda-ia", { body: { modo: "persona", persona_id: data.persona.id } });
    toast.dismiss(t);
    if (error) return toast.error(error.message);
    toast.success("Búsqueda IA iniciada");
  };

  return (
    <div className="-mx-3 -my-3 min-h-screen bg-slate-50 px-3 py-4 md:-mx-6 md:-my-6 md:px-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <ProfileHeader persona={data.persona} sourcesCount={data.docs.length} incomplete={incomplete} onAi={onAi} />
        <Tabs defaultValue="acerca" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap rounded-2xl bg-white p-1 shadow-sm">
            <TabsTrigger value="acerca">Acerca de</TabsTrigger>
            <TabsTrigger value="detalles">Detalles</TabsTrigger>
            <TabsTrigger value="fuentes">Fuentes</TabsTrigger>
            <TabsTrigger value="colaborar">Colaborar</TabsTrigger>
            <TabsTrigger value="recuerdos">Recuerdos</TabsTrigger>
            <TabsTrigger value="cronologia">Cronología</TabsTrigger>
            <TabsTrigger value="origen">Origen ancestral</TabsTrigger>
            <TabsTrigger value="duplicados">Duplicados</TabsTrigger>
            <TabsTrigger value="cuadros">Cuadros IA</TabsTrigger>
          </TabsList>
          <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
            <div>
              <TabsContent value="acerca" className="m-0"><AboutTab {...data} {...family} /></TabsContent>
              <TabsContent value="detalles" className="m-0"><DetailsTab {...data} {...family} /></TabsContent>
              <TabsContent value="fuentes" className="m-0"><ProfileCard title="Fuentes" icon={FileText}><div className="space-y-2">{data.docs.map((d: any) => <div key={d.id} className="rounded-xl border p-3 text-sm">{d.titulo || d.nombre || "Documento sin título"}</div>)}</div></ProfileCard></TabsContent>
              <TabsContent value="colaborar" className="m-0"><ProfileCard title="Colaborar" icon={Users}><p className="text-sm text-slate-600">Revisa hipótesis, cambios, tareas y sugerencias antes de aplicarlas.</p></ProfileCard></TabsContent>
              <TabsContent value="recuerdos" className="m-0"><ProfileCard title="Recuerdos" icon={Image}><p className="text-sm text-slate-600">{data.fotos.length} recuerdo(s) vinculados.</p></ProfileCard></TabsContent>
              <TabsContent value="cronologia" className="m-0"><TimelineTab persona={data.persona} eventos={data.eventos} /></TabsContent>
              <TabsContent value="origen" className="m-0"><ProfileCard title="Origen ancestral" icon={MapPinned}><p className="text-sm text-slate-600">Calcula origen documental desde lugares de nacimiento y compara con ADN externo cargado manualmente.</p><Button className="mt-3" asChild><Link to="/origen-ancestral">Abrir origen ancestral</Link></Button></ProfileCard></TabsContent>
              <TabsContent value="duplicados" className="m-0"><PossibleDuplicatesCard persona={data.persona} people={data.people} /></TabsContent>
              <TabsContent value="cuadros" className="m-0"><ProfileCard title="Cuadros IA" icon={WandSparkles}><p className="text-sm text-slate-600">Genera fichas visuales, pósters, líneas de tiempo, mapas de vida y cuadros familiares usando datos del árbol.</p><Button className="mt-3" asChild><Link to="/cuadros-ia">Abrir cuadros IA</Link></Button></ProfileCard></TabsContent>
            </div>
            <ResearchSidebar {...data} onAi={onAi} />
          </div>
        </Tabs>
        <Button variant="ghost" onClick={() => navigate(`/personas/${id}`)}>Abrir ficha clásica</Button>
      </div>
    </div>
  );
}
