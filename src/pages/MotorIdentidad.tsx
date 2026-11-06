import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveTreeId } from "@/lib/peopleData";
import { birthLabel, personAge } from "@/lib/personDates";
import { GeneIcon } from "@/components/GeneIcon";
import PersonPortrait from "@/components/PersonPortrait";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
const db = supabase as SupabaseClient;
type Note = { id:string; source_person_id:string|null; candidate_person_id:string; document_id:string|null; subject_name:string; candidate_name:string; source_label:string; excerpt:string|null; reasons:string[]; conflicts:string[]; score:number; model_version:string; status:string };
type Person = { id:string; nombres:string; apellidos:string; foto_url:string|null; nac_fecha:string|null; nac_fecha_aprox:string|null; nac_rango_ini:number|null; nac_rango_fin:number|null; defuncion_fecha:string|null; viva:string; variantes_nombre:string[]|null; nacimiento:{ciudad:string|null;pais:string|null}|null };
export default function MotorIdentidad() {
  const { user } = useAuth();
  const [tree,setTree] = useState<{id:string;nombre:string}|null>(null);
  const [stats,setStats] = useState({total:0,pending:0,notes:0});
  const [notes,setNotes] = useState<Note[]>([]), [status,setStatus] = useState("pending"), [limit,setLimit] = useState(40);
  const [loading,setLoading] = useState(true), [error,setError] = useState("");
  const [selected,setSelected] = useState<Note|null>(null),[people,setPeople] = useState<Person[]>([]),[comparing,setComparing] = useState(false),[saving,setSaving] = useState(false);
  const generation = useRef(0), comparisonGeneration = useRef(0);
  const load = useCallback(async () => {
    const current=++generation.current;
    if (!user) return;
    setError("");
    try {
      const id=await getActiveTreeId(user.id);
      if(!id) { if(current===generation.current){setTree(null);setNotes([]);setStats({total:0,pending:0,notes:0});} return; }
      const {data:active,error:treeError}=await db.from("arboles").select("id,nombre").eq("id",id).eq("user_id",user.id).single();
      if(treeError) throw treeError;
      const filter={user_id:user.id,arbol_id:id};
      const results=await Promise.all([
        db.from("neural_person_index").select("person_id",{count:"exact",head:true}).match(filter),
        db.from("neural_person_index").select("person_id",{count:"exact",head:true}).match(filter).is("processed_at",null),
        db.from("neural_identity_notes").select("*",{count:"exact"}).match(filter).eq("status",status).order("score",{ascending:false}).order("id").range(0,limit-1).returns<Note[]>(),
      ]);
      for(const result of results) if(result.error) throw result.error;
      if(current!==generation.current) return;
      setTree(active);setStats({total:results[0].count??0,pending:results[1].count??0,notes:results[2].count??0});setNotes(results[2].data??[]);
    } catch { if(current===generation.current) setError("No se pudo consultar el motor de identidad. Tus fichas siguen disponibles; vuelve a intentarlo."); }
    finally {if(current===generation.current)setLoading(false);}
  },[user?.id,status,limit]);
  useEffect(()=>{setLoading(true);void load(); const interval=window.setInterval(()=>void load(),30000);
    const changed=()=>{setSelected(null);setPeople([]);void load();};
    window.addEventListener("genaia:data-changed",changed);
    return()=>{generation.current++;comparisonGeneration.current++;clearInterval(interval);window.removeEventListener("genaia:data-changed",changed);};
  },[load]);
  async function compare(note:Note) {
    const request=++comparisonGeneration.current;
    setSelected(note);setPeople([]);setComparing(true);
    const {data,error}=await db.from("personas").select("id,nombres,apellidos,foto_url,nac_fecha,nac_fecha_aprox,nac_rango_ini,nac_rango_fin,defuncion_fecha,viva,variantes_nombre,nacimiento:lugares!personas_nac_lugar_id_fkey(ciudad,pais)")
      .eq("user_id",user!.id).eq("arbol_id",tree!.id).in("id",[note.source_person_id,note.candidate_person_id].filter(Boolean) as string[]).returns<Person[]>();
    if(request!==comparisonGeneration.current)return;
    setComparing(false);
    if(error) {toast.error("No se pudieron abrir las fichas para comparar.");return;}
    setPeople(data||[]);
  }
  async function review(value:"confirmed"|"rejected") {
    if(!selected||!tree||!user)return;
    setSaving(true);
    try {
      const {data,error}=await db.from("neural_identity_notes").update({status:value}).eq("id",selected.id).eq("user_id",user.id).eq("arbol_id",tree.id).eq("status","pending").select("id").maybeSingle();
      if(error)throw error;
      if(!data)throw new Error("stale");
      toast.success(value==="confirmed"?"Coincidencia confirmada. Las fichas siguen separadas.":"Coincidencia descartada.");setSelected(null);await load();
    } catch {toast.error("La propuesta cambió o ya fue revisada. Actualiza y vuelve a compararla.");await load();}
    finally{setSaving(false);}
  }
  return <div className="mx-auto max-w-6xl space-y-6 pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><GeneIcon name="spark" className="h-5 w-5"/>GeneAI · Memoria familiar</div><h1 className="text-2xl font-bold sm:text-3xl">Motor de identidad</h1><p className="mt-2 text-sm text-muted-foreground">{tree?.nombre||"Árbol actual"} · Personas, variantes y documentos conectados.</p></div><Button variant="outline" onClick={()=>void load()} disabled={loading}><GeneIcon name="sync" className="mr-2 h-4 w-4"/>Actualizar</Button></header>
    {error&&<div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm">{error}</div>}
    {loading?<p role="status">Consultando la memoria del árbol…</p>:!tree&&!error?<p>Selecciona un árbol en <Link to="/configuracion" className="underline">Configuración</Link> para consultar su memoria.</p>:<>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[["Personas en la memoria",stats.total,"people"],["Personas procesadas",stats.total-stats.pending,"check"],["Pendientes de procesar",stats.pending,"sync"]].map(([label,value,icon])=><div key={String(label)} className="gene-glass rounded-2xl p-5"><GeneIcon name={icon as "people"} className="mb-3 h-7 w-7"/><div className="text-3xl font-semibold tabular-nums">{Number(value).toLocaleString("es-CL")}</div><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>)}</div>
      <div className="gene-glass rounded-2xl p-5 text-sm leading-relaxed"><p>La memoria se actualiza en la nube cuando editas personas, parentescos o documentos. El motor compara variantes, fechas, lugares y familiares, y conserva propuestas con sus motivos.</p><p className="mt-2 text-muted-foreground">Tú revisas cada coincidencia. Confirmarla guarda tu decisión y mantiene las fichas separadas. La prioridad del motor no representa una probabilidad de identidad.</p></div>
      <section aria-label="Propuestas de identidad"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Coincidencias para revisar <span className="text-muted-foreground">({stats.notes})</span></h2><label className="flex items-center gap-2 text-sm">Estado<select value={status} onChange={e=>{setStatus(e.target.value);setLimit(40);}} className="min-h-11 rounded-xl border bg-background/60 px-3"><option value="pending">Pendientes</option><option value="confirmed">Confirmadas</option><option value="rejected">Descartadas</option></select></label></div>
      {!notes.length&&!error?<div className="gene-glass rounded-2xl p-8 text-center text-muted-foreground">{stats.pending?"El motor está procesando cambios. Las nuevas propuestas aparecerán aquí.":"No hay propuestas en este estado."}</div>:<div className="grid gap-3">{notes.map(note=><button key={note.id} onClick={()=>void compare(note)} className="gene-glass flex w-full items-start gap-4 rounded-2xl p-5 text-left transition-colors hover:border-primary/50"><GeneIcon name="compare" className="mt-1 h-8 w-8 shrink-0"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold"><span>{note.subject_name}</span><span className="text-muted-foreground">↔</span><span>{note.candidate_name}</span></div><p className="mt-1 text-xs text-muted-foreground">{note.source_label} · {note.source_person_id?"Dos fichas del mismo árbol":"Documento y ficha"}</p><p className="mt-3 text-sm">{note.reasons.slice(0,2).join(" ")}</p>{note.conflicts.length>0&&<p className="mt-2 text-sm text-amber-600 dark:text-amber-300">Hay datos que no coinciden.</p>}<span className="mt-3 inline-block text-xs font-semibold text-primary">Comparar detalles →</span></div></button>)}</div>}
      {notes.length<stats.notes&&<Button variant="outline" className="mt-4" onClick={()=>setLimit(n=>n+40)}>Mostrar más · {notes.length} de {stats.notes}</Button>}</section>
    </>}
    <Dialog open={!!selected} onOpenChange={open=>{if(!open){comparisonGeneration.current++;setSelected(null);}}}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Comparar identidad</DialogTitle><DialogDescription>Revisa las fechas, variantes y fuentes antes de decidir.</DialogDescription></DialogHeader>
      {selected&&<><div className="grid gap-3 sm:grid-cols-2">{[selected.source_person_id,selected.candidate_person_id].map((id,index)=>{
        const person=people.find(p=>p.id===id);
        return <article key={index} className="rounded-2xl border bg-background/30 p-4"><p className="mb-3 text-xs text-muted-foreground">{index===0&&!id?"Mención en documento":"Ficha del árbol"}</p>{person&&<PersonPortrait person={person} className="mb-3 h-14 w-14 rounded-xl"/>}<h3 className="font-semibold">{person?`${person.nombres} ${person.apellidos}`:index===0?selected.subject_name:selected.candidate_name}</h3>{comparing?<p className="mt-3 text-sm">Abriendo ficha…</p>:person?<><dl className="mt-3 space-y-2 text-sm"><div><dt className="text-xs text-muted-foreground">Nacimiento</dt><dd>{birthLabel(person,true)||"Sin fecha"}</dd></div><div><dt className="text-xs text-muted-foreground">Lugar</dt><dd>{[person.nacimiento?.ciudad,person.nacimiento?.pais].filter(Boolean).join(", ")||"Sin lugar"}</dd></div><div><dt className="text-xs text-muted-foreground">Defunción · edad</dt><dd>{person.defuncion_fecha||"Sin fecha"}{personAge(person)?` · ${personAge(person)}`:""}</dd></div><div><dt className="text-xs text-muted-foreground">Variantes</dt><dd>{person.variantes_nombre?.join(" · ")||"Sin variantes"}</dd></div></dl><Link to={`/personas/${id}`} className="mt-4 inline-block text-sm font-semibold text-primary">Abrir ficha →</Link></>:!id?<><blockquote className="mt-3 text-sm">{selected.excerpt}</blockquote><Link to={`/documentos/${selected.document_id}`} className="mt-4 inline-block text-sm text-primary">Abrir documento →</Link></>:<p className="mt-3 text-sm">La ficha ya no está disponible.</p>}</article>;
      })}</div><div className="space-y-2 text-sm">{selected.reasons.map(reason=><p key={reason} className="flex gap-2"><GeneIcon name="check" className="h-5 w-5 shrink-0"/>{reason}</p>)}{selected.conflicts.map(conflict=><p key={conflict} className="text-amber-600 dark:text-amber-300">{conflict}</p>)}</div><p className="text-xs text-muted-foreground">{selected.model_version} · Propuesta de comparación. Confirmar no fusiona ni modifica los datos de las personas.</p>{selected.status==="pending"&&<div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={saving||comparing} onClick={()=>void review("rejected")}>Descartar</Button><Button disabled={saving||comparing||people.length<(selected.source_person_id?2:1)} onClick={()=>void review("confirmed")}>Confirmar coincidencia</Button></div>}</>}
    </DialogContent></Dialog>
  </div>;
}
