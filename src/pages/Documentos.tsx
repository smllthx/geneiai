import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ExternalLink, Plus, Save, Trash2, Upload, Search, LayoutGrid, List, FileText, Image as ImageIcon, ScanLine, UserPlus, X, Sparkles } from "lucide-react";
import { applyTreeScope, fetchAllPeople, getActiveTreeId, withTreeScope } from "@/lib/peopleData";
import { extractDocumentAI } from "@/lib/aiApi";

const TIPOS = ["acta_civil","partida_parroquial","pasaporte","lista_pasajeros","censo","foto","certificado","lapida","carta","familysearch","myheritage","relato_familiar","periodico","cementerio","otro"];
const ESTADOS = ["pendiente","transcrito","verificado","dudoso"];

export default function Documentos() {
  const { id: docId } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>({ titulo: "", tipo: "otro", fecha: "", estado: "pendiente", transcripcion: "", cita: "", repositorio: "", url: "", resumen: "", personas_mencionadas: [] });
  const [file, setFile] = useState<File | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editDoc, setEditDoc] = useState<any | null>(null);
  const [draftPersona, setDraftPersona] = useState("none");
  const [editPersona, setEditPersona] = useState("none");

  // Filtros
  const [q, setQ] = useState("");
  const [fTipo, setFTipo] = useState<string>("all");
  const [fEstado, setFEstado] = useState<string>("all");
  const [fPersona, setFPersona] = useState<string>("all");
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const selectedDoc = useMemo(() => items.find((d) => d.id === docId) ?? null, [items, docId]);

  const load = async () => {
    try {
      const treeId = await getActiveTreeId();
      const docsQuery = supabase.from("documentos").select("*").order("created_at", { ascending: false });
      const [{ data, error }, ps] = await Promise.all([
        applyTreeScope(docsQuery as any, treeId),
        fetchAllPeople<any>("id,nombres,apellidos", { treeId }),
      ]);
      if (error) throw error;
      setItems(data ?? []); setPersonas(ps ?? []);
      // Genera signed URLs para thumbnails
      const t: Record<string, string> = {};
      await Promise.all((data ?? []).filter((d) => d.archivo_path).map(async (d) => {
        const { data: s } = await supabase.storage.from("documentos").createSignedUrl(d.archivo_path, 3600);
        if (s?.signedUrl) t[d.id] = s.signedUrl;
      }));
      setThumbs(t);
    } catch (e: any) {
      toast.error(e.message ?? "No se pudieron cargar los documentos");
      setItems([]);
      setPersonas([]);
      setThumbs({});
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    setEditDoc(selectedDoc ? { ...selectedDoc } : null);
    setEditPersona("none");
  }, [selectedDoc?.id]);

  const personName = (id: string) => {
    const p = personas.find((persona) => persona.id === id);
    return p ? `${p.nombres ?? ""} ${p.apellidos ?? ""}`.trim() : id;
  };

  const addPersonRef = (target: any, setter: (value: any) => void, personId: string) => {
    if (!personId || personId === "none") return;
    const personas_mencionadas = Array.from(new Set([...(target.personas_mencionadas ?? []), personId]));
    setter({ ...target, personas_mencionadas });
  };

  const removePersonRef = (target: any, setter: (value: any) => void, personId: string) => {
    setter({ ...target, personas_mencionadas: (target.personas_mencionadas ?? []).filter((id: string) => id !== personId) });
  };

  const add = async () => {
    if (!draft.titulo) return toast.error("Falta título");
    const user = (await supabase.auth.getUser()).data.user!;
    const treeId = await getActiveTreeId(user.id);
    let archivo_path: string | null = null;
    if (file) {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("documentos").upload(path, file);
      if (error) return toast.error(error.message);
      archivo_path = path;
    }
    const { error } = await supabase.from("documentos").insert(withTreeScope({
      ...draft,
      fecha: draft.fecha || null,
      url: draft.url || null,
      resumen: draft.resumen || null,
      cita: draft.cita || null,
      repositorio: draft.repositorio || null,
      transcripcion: draft.transcripcion || null,
      archivo_path,
      user_id: user.id,
    }, treeId));
    if (error) return toast.error(error.message);
    toast.success("Documento creado");
    setDraft({ titulo: "", tipo: "otro", fecha: "", estado: "pendiente", transcripcion: "", cita: "", repositorio: "", url: "", resumen: "", personas_mencionadas: [] });
    setFile(null); setShowForm(false); load();
  };

  const saveEditDoc = async () => {
    if (!editDoc?.id) return;
    const { error } = await supabase.from("documentos").update({
      titulo: editDoc.titulo,
      tipo: editDoc.tipo,
      fecha: editDoc.fecha || null,
      estado: editDoc.estado,
      transcripcion: editDoc.transcripcion || null,
      cita: editDoc.cita || null,
      repositorio: editDoc.repositorio || null,
      url: editDoc.url || null,
      resumen: editDoc.resumen || null,
      personas_mencionadas: editDoc.personas_mencionadas ?? [],
    }).eq("id", editDoc.id);
    if (error) return toast.error(error.message);
    toast.success("Fuente actualizada");
    await load();
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar documento?")) return;
    await supabase.from("documentos").delete().eq("id", id); load();
  };

  const transcribir = async (id: string) => {
    const t = toast.loading("Analizando documento con IA…");
    try {
      const { error } = await supabase.functions.invoke("leer-documento-ia", { body: { documento_id: id } });
      if (error) throw error;
      toast.dismiss(t); toast.success("Transcripción IA solicitada"); load();
    } catch (e: any) { toast.dismiss(t); toast.error(e.message ?? "Error"); }
  };

  const extraerDatosIA = async (id: string) => {
    const t = toast.loading("Extrayendo nombres, fechas y lugares…");
    try {
      const result = await extractDocumentAI({ document_id: id });
      toast.dismiss(t);
      toast.success(`${result.data?.names?.length ?? 0} nombre(s), ${result.data?.dates?.length ?? 0} fecha(s), ${result.data?.locations?.length ?? 0} lugar(es) extraídos`);
      window.dispatchEvent(new CustomEvent("genaia:data-changed", { detail: { source: "document_ai_data" } }));
      load();
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e.message ?? "No se pudo extraer datos");
    }
  };

  const filtered = useMemo(() => {
    const qn = q.trim().toLowerCase();
    return items.filter((d) => {
      if (fTipo !== "all" && d.tipo !== fTipo) return false;
      if (fEstado !== "all" && d.estado !== fEstado) return false;
      if (fPersona !== "all" && !(d.personas_mencionadas ?? []).includes(fPersona)) return false;
      if (fDesde && (!d.fecha || d.fecha < fDesde)) return false;
      if (fHasta && (!d.fecha || d.fecha > fHasta)) return false;
      if (qn) {
        const hay = `${d.titulo} ${d.transcripcion ?? ""} ${d.cita ?? ""} ${d.repositorio ?? ""} ${d.url ?? ""} ${d.resumen ?? ""}`.toLowerCase();
        if (!hay.includes(qn)) return false;
      }
      return true;
    });
  }, [items, q, fTipo, fEstado, fPersona, fDesde, fHasta]);

  const isImage = (path?: string | null) => !!path && /\.(jpe?g|png|gif|webp|heic)$/i.test(path);

  const estadoColor = (e: string) =>
    e === "verificado" ? "default" : e === "dudoso" ? "destructive" : e === "transcrito" ? "secondary" : "outline";

  return (
    <div>
      <PageHeader
        title="Documentos y fuentes"
        subtitle="Organiza actas, fotos y archivos. Filtra por tipo, persona o fecha y transcribe con IA."
        actions={
          <Button
            variant="outline"
            onClick={async () => {
              const t = toast.loading("Analizando documentos con IA…");
              try {
                const { data, error } = await supabase.functions.invoke("documentos-a-sugerencias", { body: { max: 15 } });
                if (error) throw error;
                toast.dismiss(t);
                toast.success(`${data?.creadas ?? 0} sugerencias · ${data?.duplicadas ?? 0} duplicadas omitidas`);
              } catch (e: any) { toast.dismiss(t); toast.error(e.message ?? "Error"); }
            }}
          >
            <ScanLine className="h-4 w-4" /> Extraer personas → Sugerencias
          </Button>
        }
      />

      {/* Barra de filtros */}
      <Card className="archivo-card mb-4"><CardContent className="grid gap-2 pt-4 md:grid-cols-6">
        <div className="md:col-span-2 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar título, transcripción, cita…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={fTipo} onValueChange={setFTipo}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos los tipos</SelectItem>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={fEstado} onValueChange={setFEstado}>
          <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem>{ESTADOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={fPersona} onValueChange={setFPersona}>
          <SelectTrigger><SelectValue placeholder="Persona" /></SelectTrigger>
          <SelectContent className="max-h-64"><SelectItem value="all">Toda persona</SelectItem>{personas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombres} {p.apellidos}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex gap-1">
          <Input type="date" value={fDesde} onChange={(e) => setFDesde(e.target.value)} title="Desde" />
          <Input type="date" value={fHasta} onChange={(e) => setFHasta(e.target.value)} title="Hasta" />
        </div>
        <div className="md:col-span-6 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{filtered.length} de {items.length} documentos</div>
          <div className="flex gap-1">
            <Button size="sm" variant={view === "grid" ? "default" : "outline"} onClick={() => setView("grid")}><LayoutGrid className="h-4 w-4" /></Button>
            <Button size="sm" variant={view === "list" ? "default" : "outline"} onClick={() => setView("list")}><List className="h-4 w-4" /></Button>
            <Button size="sm" onClick={() => setShowForm((v) => !v)}><Plus className="h-4 w-4" /> Nuevo</Button>
          </div>
        </div>
      </CardContent></Card>

      {/* Formulario plegable */}
      {showForm && (
        <Card className="archivo-card mb-6"><CardContent className="grid gap-3 pt-6 md:grid-cols-2">
          <div><Label>Título</Label><Input value={draft.titulo} onChange={(e) => setDraft({ ...draft, titulo: e.target.value })} /></div>
          <div><Label>Tipo</Label>
            <Select value={draft.tipo} onValueChange={(v) => setDraft({ ...draft, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label>Fecha</Label><Input type="date" value={draft.fecha} onChange={(e) => setDraft({ ...draft, fecha: e.target.value })} /></div>
          <div><Label>Estado</Label>
            <Select value={draft.estado} onValueChange={(v) => setDraft({ ...draft, estado: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ESTADOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="md:col-span-2"><Label>Transcripción</Label><Textarea rows={3} value={draft.transcripcion} onChange={(e) => setDraft({ ...draft, transcripcion: e.target.value })} /></div>
          <div><Label>Link externo / archivo web</Label><Input value={draft.url} placeholder="https://..." onChange={(e) => setDraft({ ...draft, url: e.target.value })} /></div>
          <div><Label>Extracto / resumen</Label><Input value={draft.resumen} onChange={(e) => setDraft({ ...draft, resumen: e.target.value })} /></div>
          <div><Label>Cita / referencia</Label><Input value={draft.cita} onChange={(e) => setDraft({ ...draft, cita: e.target.value })} /></div>
          <div><Label>Repositorio / archivo</Label><Input value={draft.repositorio} onChange={(e) => setDraft({ ...draft, repositorio: e.target.value })} /></div>
          <div className="md:col-span-2">
            <Label>Personas vinculadas a esta fuente</Label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <Select value={draftPersona} onValueChange={setDraftPersona}>
                <SelectTrigger><SelectValue placeholder="Elegir persona" /></SelectTrigger>
                <SelectContent className="max-h-64"><SelectItem value="none">Elegir persona</SelectItem>{personas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombres} {p.apellidos}</SelectItem>)}</SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  addPersonRef(draft, setDraft, draftPersona);
                  setDraftPersona("none");
                }}
              >
                <UserPlus className="h-4 w-4" /> Vincular
              </Button>
            </div>
            {(draft.personas_mencionadas ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {draft.personas_mencionadas.map((id: string) => (
                  <button key={id} type="button" onClick={() => removePersonRef(draft, setDraft, id)} className="rounded-full border border-border/70 px-2 py-1 text-xs hover:bg-foreground/10">
                    {personName(id)} <X className="ml-1 inline h-3 w-3" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="md:col-span-2"><Label>Archivo (PDF / imagen, sin límite de páginas)</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
          <div className="md:col-span-2 flex gap-2">
            <Button onClick={add}><Plus className="h-4 w-4" /> {file && <Upload className="h-4 w-4" />} Añadir documento</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </CardContent></Card>
      )}

      {editDoc && (
        <Card className="archivo-card mb-6 border-primary/30">
          <CardContent className="grid gap-3 pt-6 md:grid-cols-2">
            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-primary">Editor de fuente</p>
                <h2 className="font-serif text-2xl font-semibold">{editDoc.titulo || "Fuente sin título"}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {editDoc.url && (
                  <Button variant="outline" asChild>
                    <a href={editDoc.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Abrir link</a>
                  </Button>
                )}
                <Button variant="outline" onClick={() => transcribir(editDoc.id)}><ScanLine className="h-4 w-4" /> Transcribir con IA</Button>
                <Button variant="outline" onClick={() => extraerDatosIA(editDoc.id)}><Sparkles className="h-4 w-4" /> Extraer datos IA</Button>
                <Button onClick={saveEditDoc}><Save className="h-4 w-4" /> Guardar fuente</Button>
                <Button variant="ghost" onClick={() => navigate("/documentos")}>Cerrar</Button>
              </div>
            </div>

            <div><Label>Título</Label><Input value={editDoc.titulo ?? ""} onChange={(e) => setEditDoc({ ...editDoc, titulo: e.target.value })} /></div>
            <div><Label>Clasificación</Label>
              <Select value={editDoc.tipo ?? "otro"} onValueChange={(v) => setEditDoc({ ...editDoc, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Fecha</Label><Input type="date" value={editDoc.fecha ?? ""} onChange={(e) => setEditDoc({ ...editDoc, fecha: e.target.value })} /></div>
            <div><Label>Estado</Label>
              <Select value={editDoc.estado ?? "pendiente"} onValueChange={(v) => setEditDoc({ ...editDoc, estado: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ESTADOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Link externo / internet</Label><Input value={editDoc.url ?? ""} placeholder="https://..." onChange={(e) => setEditDoc({ ...editDoc, url: e.target.value })} /></div>
            <div><Label>Repositorio / archivo</Label><Input value={editDoc.repositorio ?? ""} onChange={(e) => setEditDoc({ ...editDoc, repositorio: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Cita / referencia</Label><Input value={editDoc.cita ?? ""} onChange={(e) => setEditDoc({ ...editDoc, cita: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Extracto, resumen o hallazgo IA</Label><Textarea rows={3} value={editDoc.resumen ?? ""} onChange={(e) => setEditDoc({ ...editDoc, resumen: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Transcripción completa</Label><Textarea rows={5} value={editDoc.transcripcion ?? ""} onChange={(e) => setEditDoc({ ...editDoc, transcripcion: e.target.value })} /></div>

            <div className="md:col-span-2">
              <Label>Vincular fuente a personas</Label>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <Select value={editPersona} onValueChange={setEditPersona}>
                  <SelectTrigger><SelectValue placeholder="Elegir persona" /></SelectTrigger>
                  <SelectContent className="max-h-64"><SelectItem value="none">Elegir persona</SelectItem>{personas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombres} {p.apellidos}</SelectItem>)}</SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    addPersonRef(editDoc, setEditDoc, editPersona);
                    setEditPersona("none");
                  }}
                >
                  <UserPlus className="h-4 w-4" /> Vincular
                </Button>
              </div>
              {(editDoc.personas_mencionadas ?? []).length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {editDoc.personas_mencionadas.map((id: string) => (
                    <button key={id} type="button" onClick={() => removePersonRef(editDoc, setEditDoc, id)} className="rounded-full border border-border/70 px-2 py-1 text-xs hover:bg-foreground/10">
                      {personName(id)} <X className="ml-1 inline h-3 w-3" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Todavía no está vinculada a ninguna persona.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultado: grid o lista */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          Sin documentos que coincidan con los filtros.
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((d) => (
            <Card key={d.id} className="archivo-card overflow-hidden">
              <Link to={`/documentos/${d.id}`} className="block">
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
                  {isImage(d.archivo_path) && thumbs[d.id] ? (
                    <img src={thumbs[d.id]} alt={d.titulo} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground">
                      {d.archivo_path ? <FileText className="h-10 w-10" /> : <ImageIcon className="h-10 w-10" />}
                      <span className="mt-1 text-xs">{d.tipo}</span>
                    </div>
                  )}
                  <Badge className="absolute right-2 top-2" variant={estadoColor(d.estado) as any}>{d.estado}</Badge>
                </div>
              </Link>
              <CardContent className="p-3">
                <div className="line-clamp-2 font-serif text-sm font-semibold">{d.titulo}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{d.tipo} · {d.fecha ?? "s/f"}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {d.url && <Badge variant="outline">link</Badge>}
                  {d.cita && <Badge variant="outline">cita</Badge>}
                  {(d.personas_mencionadas ?? []).length > 0 && <Badge variant="secondary">{(d.personas_mencionadas ?? []).length} personas</Badge>}
                </div>
                <div className="mt-2 flex items-center justify-between gap-1">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => transcribir(d.id)}>
                    <ScanLine className="h-3 w-3" /> IA
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => extraerDatosIA(d.id)}>
                    <Sparkles className="h-3 w-3" /> Datos
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => del(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((d) => (
            <Card key={d.id} className="archivo-card"><CardContent className="flex items-start gap-3 pt-4">
              {isImage(d.archivo_path) && thumbs[d.id] ? (
                <img src={thumbs[d.id]} alt="" className="h-16 w-16 shrink-0 rounded object-cover" loading="lazy" />
              ) : (
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded bg-muted text-muted-foreground"><FileText className="h-6 w-6" /></div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate font-serif text-lg">{d.titulo}</div>
                  <Badge variant={estadoColor(d.estado) as any}>{d.estado}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{d.tipo} · {d.fecha ?? "s/f"} {d.repositorio ? `· ${d.repositorio}` : ""}</div>
                {d.resumen && <p className="mt-1 line-clamp-2 text-sm">{d.resumen}</p>}
                {!d.resumen && d.transcripcion && <p className="mt-1 line-clamp-2 text-sm">{d.transcripcion}</p>}
                <div className="mt-1 flex flex-wrap gap-1">
                  {d.url && <Badge variant="outline">link externo</Badge>}
                  {d.cita && <Badge variant="outline">cita</Badge>}
                  {(d.personas_mencionadas ?? []).length > 0 && <Badge variant="secondary">{(d.personas_mencionadas ?? []).length} personas vinculadas</Badge>}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Button size="sm" variant="outline" onClick={() => transcribir(d.id)}><ScanLine className="h-3.5 w-3.5" /> IA</Button>
                <Button size="sm" variant="outline" onClick={() => extraerDatosIA(d.id)}><Sparkles className="h-3.5 w-3.5" /> Datos</Button>
                <Button size="sm" variant="ghost" onClick={() => del(d.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
