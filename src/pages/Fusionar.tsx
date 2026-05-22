import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, GitMerge, Trash2, ArrowLeftRight, Clock, Hash, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { personaCode, matchesCode, normalizeCode } from "@/lib/personaCode";
import { fusionarPersonas } from "@/lib/mergePersonas";
import { getRecent } from "@/lib/recent";

function PersonaPicker({ label, value, onChange, personas, exclude }: {
  label: string; value: any; onChange: (p: any) => void; personas: any[]; exclude?: string;
}) {
  const [q, setQ] = useState("");
  const recientes = useMemo(() => {
    const ids = getRecent().map((r) => r.id).filter((id) => id !== exclude);
    const byId = new Map(personas.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter(Boolean).slice(0, 5);
  }, [personas, exclude]);
  const filtered = useMemo(() => {
    if (!q.trim()) return [];
    const lower = q.toLowerCase();
    const codeNorm = normalizeCode(q);
    const looksLikeCode = codeNorm.length >= 3;
    return personas.filter((p) => {
      if (p.id === exclude) return false;
      if (looksLikeCode && matchesCode(q, p.id)) return true;
      return `${p.nombres} ${p.apellidos}`.toLowerCase().includes(lower);
    }).slice(0, 8);
  }, [q, personas, exclude]);

  return (
    <Card className="archivo-card">
      <CardContent className="space-y-3 py-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        {value ? (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold">{value.nombres} {value.apellidos}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{personaCode(value.id)}</span>
                  {value.nac_fecha && <span>n. {new Date(value.nac_fecha).getUTCFullYear()}</span>}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onChange(null)}>Cambiar</Button>
            </div>
          </div>
        ) : (
          <>
            <Input
              placeholder="Buscar por nombre o código (ej. GDVB-TS5)…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && filtered.length > 0 && (
              <div className="space-y-1">
                {filtered.map((p) => (
                  <button key={p.id} onClick={() => { onChange(p); setQ(""); }}
                    className="flex w-full items-center justify-between rounded-md border border-border/50 px-3 py-2 text-left text-sm hover:border-primary/40 hover:bg-primary/5">
                    <span><strong>{p.nombres}</strong> {p.apellidos}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{personaCode(p.id)}</span>
                  </button>
                ))}
              </div>
            )}
            {!q && recientes.length > 0 && (
              <div>
                <div className="mb-1 flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <Clock className="h-3 w-3" /> Vistas recientemente
                </div>
                <div className="space-y-1">
                  {recientes.map((p: any) => (
                    <button key={p.id} onClick={() => onChange(p)}
                      className="flex w-full items-center justify-between rounded-md border border-border/50 px-3 py-2 text-left text-sm hover:border-primary/40 hover:bg-primary/5">
                      <span><strong>{p.nombres}</strong> {p.apellidos}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{personaCode(p.id)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function Fusionar() {
  const navigate = useNavigate();
  const [personas, setPersonas] = useState<any[]>([]);
  const [target, setTarget] = useState<any>(null);
  const [source, setSource] = useState<any>(null);
  const [duplicados, setDuplicados] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [merging, setMerging] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("personas").select("*").order("apellidos");
    setPersonas(data ?? []);
  };
  useEffect(() => { load(); }, []);

  // Pre-cargar duplicados detectados
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("coincidencias").select("*").eq("tipo", "duplicado").eq("estado", "pendiente").order("score", { ascending: false });
      setDuplicados(data ?? []);
    })();
  }, [personas]);

  const escanear = async () => {
    setScanning(true);
    const t = toast.loading("IA buscando personas duplicadas…");
    try {
      const { data, error } = await supabase.functions.invoke("detectar-duplicados", {});
      toast.dismiss(t);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${data.pares?.length ?? 0} pares candidatos`);
      const { data: c } = await supabase.from("coincidencias").select("*").eq("tipo", "duplicado").eq("estado", "pendiente").order("score", { ascending: false });
      setDuplicados(c ?? []);
    } catch (e: any) { toast.dismiss(t); toast.error(e.message ?? "Error"); }
    finally { setScanning(false); }
  };

  const fusionar = async () => {
    if (!target || !source) return;
    if (target.id === source.id) return toast.error("Elige dos personas distintas");
    if (!confirm(`Fusionar "${source.nombres} ${source.apellidos}" dentro de "${target.nombres} ${target.apellidos}"?\n\nLa segunda persona se eliminará y sus datos se moverán a la primera. Esta acción no se puede deshacer.`)) return;
    setMerging(true);
    const t = toast.loading("Fusionando personas…");
    try {
      const res = await fusionarPersonas(target.id, source.id);
      toast.dismiss(t);
      const s = res.summary;
      toast.success(`Fusión completada: ${s.relaciones} relaciones · ${s.eventos} eventos · ${s.fotos} fotos · ${s.documentos} documentos`);
      setTarget(null); setSource(null);
      load();
    } catch (e: any) { toast.dismiss(t); toast.error(e.message ?? "Error en fusión"); }
    finally { setMerging(false); }
  };

  const fusionarPar = async (a_id: string, b_id: string, coincidencia_id: string) => {
    const a = personas.find((p) => p.id === a_id);
    const b = personas.find((p) => p.id === b_id);
    if (!a || !b) return toast.error("Persona no encontrada");
    if (!confirm(`Fusionar "${b.nombres} ${b.apellidos}" dentro de "${a.nombres} ${a.apellidos}"?`)) return;
    const t = toast.loading("Fusionando…");
    try {
      const res = await fusionarPersonas(a.id, b.id);
      await supabase.from("coincidencias").update({ estado: "fusionada" }).eq("id", coincidencia_id);
      toast.dismiss(t);
      toast.success(`Fusión completada (${res.summary.relaciones} relaciones)`);
      load();
      const { data: c } = await supabase.from("coincidencias").select("*").eq("tipo", "duplicado").eq("estado", "pendiente").order("score", { ascending: false });
      setDuplicados(c ?? []);
    } catch (e: any) { toast.dismiss(t); toast.error(e.message ?? "Error"); }
  };

  const descartarPar = async (id: string) => {
    await supabase.from("coincidencias").update({ estado: "rechazada" }).eq("id", id);
    setDuplicados((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div>
      <PageHeader
        title="Fusionar y combinar personas"
        subtitle="Detecta duplicados con IA o fusiona manualmente dos fichas (por nombre o por código)."
        actions={<Button onClick={escanear} disabled={scanning}><Sparkles className="h-4 w-4" /> {scanning ? "Escaneando…" : "Detectar duplicados con IA"}</Button>}
      />

      <div className="mb-6 space-y-3">
        <h2 className="font-serif text-lg font-semibold">Candidatos detectados ({duplicados.length})</h2>
        {duplicados.length === 0 ? (
          <Card className="archivo-card"><CardContent className="py-8 text-center text-sm text-muted-foreground">
            Aún no hay duplicados detectados. Lanza el escaneo IA.
          </CardContent></Card>
        ) : duplicados.map((d) => {
          const a = personas.find((p) => p.id === d.ref_a);
          const b = personas.find((p) => p.id === d.ref_b);
          if (!a || !b) return null;
          const motivo = Array.isArray(d.razones) && d.razones[0]?.motivo;
          return (
            <Card key={d.id} className="archivo-card">
              <CardContent className="py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => navigate(`/personas/${a.id}`)} className="font-bold hover:text-primary">{a.nombres} {a.apellidos}</button>
                      <span className="font-mono text-[10px] text-muted-foreground">{personaCode(a.id)}</span>
                      <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <button onClick={() => navigate(`/personas/${b.id}`)} className="font-bold hover:text-primary">{b.nombres} {b.apellidos}</button>
                      <span className="font-mono text-[10px] text-muted-foreground">{personaCode(b.id)}</span>
                      <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{d.score}%</span>
                    </div>
                    {motivo && <p className="mt-1 text-xs text-muted-foreground">{motivo}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => descartarPar(d.id)}>Descartar</Button>
                    <Button size="sm" onClick={() => fusionarPar(a.id, b.id, d.id)}>
                      <GitMerge className="h-3.5 w-3.5" /> Fusionar B → A
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="space-y-3">
        <h2 className="font-serif text-lg font-semibold">Fusión manual</h2>
        <p className="text-sm text-muted-foreground">
          Busca por nombre o pega el código (ej. <span className="font-mono">GDVB-TS5</span>). La persona <strong>A</strong> se conserva; <strong>B</strong> se elimina y sus datos se transfieren.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <PersonaPicker label="A · Persona que se conserva" value={target} onChange={setTarget} personas={personas} exclude={source?.id} />
          <ArrowRight className="mx-auto hidden h-5 w-5 text-muted-foreground sm:block" />
          <PersonaPicker label="B · Persona que se fusiona (será eliminada)" value={source} onChange={setSource} personas={personas} exclude={target?.id} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          {source && (
            <Button variant="outline" onClick={async () => {
              if (!confirm(`Eliminar definitivamente a "${source.nombres} ${source.apellidos}"?`)) return;
              const t = toast.loading("Eliminando…");
              const { error } = await supabase.from("personas").delete().eq("id", source.id);
              toast.dismiss(t);
              if (error) return toast.error(error.message);
              toast.success("Persona eliminada");
              setSource(null); load();
            }}><Trash2 className="h-4 w-4" /> Eliminar B</Button>
          )}
          <Button onClick={fusionar} disabled={!target || !source || merging}>
            <GitMerge className="h-4 w-4" /> Fusionar
          </Button>
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Hash className="h-3 w-3" /> También puedes pegar el código <span className="font-mono">XXXX-YYY</span> de FamilySearch-style para identificar a la persona.
        </p>
      </div>
    </div>
  );
}
