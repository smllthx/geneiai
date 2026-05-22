import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Check, X, FileText, Loader2, Sparkles, Search, Users, ChevronDown } from "lucide-react";

type Sugerencia = {
  id: string;
  tipo: string;
  titulo: string;
  descripcion: string | null;
  confianza: number;
  origen: string | null;
  estado: string;
  payload: any;
  created_at: string;
  persona_id?: string | null;
  url_externa?: string | null;
  tipo_externo?: string | null;
};

export default function Sugerencias() {
  const [items, setItems] = useState<Sugerencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [q, setQ] = useState("");
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("sugerencias")
      .select("*")
      .in("tipo", ["persona", "actualizacion_persona", "fuente"])
      .eq("estado", "pendiente")
      .order("created_at", { ascending: false })
      .limit(2000);
    setItems((data ?? []) as Sugerencia[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const extraer = async () => {
    setRunning(true);
    const t = toast.loading("Analizando documentos con IA…");
    try {
      const { data, error } = await supabase.functions.invoke("documentos-a-sugerencias", { body: { max: 15 } });
      if (error) throw error;
      toast.dismiss(t);
      toast.success(`${data?.creadas ?? 0} sugerencias nuevas · ${data?.duplicadas ?? 0} duplicadas omitidas`);
      load();
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message ?? "Error al extraer");
    } finally {
      setRunning(false);
    }
  };

  const aceptar = async (s: Sugerencia) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return toast.error("Sesión no encontrada");
    const p = s.payload ?? {};

    // Sugerencia de actualización: aplica campos nuevos sobre la persona existente
    if (s.tipo === "actualizacion_persona" && (s as any).persona_id) {
      const nuevos = p.campos_nuevos ?? {};
      const actual = p.persona_actual ?? {};
      const patch: any = {};
      for (const k of ["sexo","nac_fecha","defuncion_fecha","ocupacion","notas"]) {
        if (nuevos[k] && !actual[k]) patch[k] = nuevos[k];
      }
      const { error } = await supabase.from("personas").update(patch).eq("id", (s as any).persona_id);
      if (error) return toast.error(error.message);
      await supabase.from("sugerencias").update({ estado: "aceptada" }).eq("id", s.id);
      setItems((xs) => xs.filter((x) => x.id !== s.id));
      return toast.success("Persona actualizada");
    }

    // Sugerencia de fuente: enlaza al campo enlaces[] de la persona
    if (s.tipo === "fuente" && (s as any).persona_id) {
      const { data: per } = await supabase.from("personas").select("enlaces").eq("id", (s as any).persona_id).maybeSingle();
      const enlaces = Array.isArray(per?.enlaces) ? per!.enlaces as any[] : [];
      enlaces.push({ url: (s as any).url_externa, titulo: s.titulo, plataforma: (s as any).tipo_externo, agregado: new Date().toISOString() });
      await supabase.from("personas").update({ enlaces }).eq("id", (s as any).persona_id);
      await supabase.from("sugerencias").update({ estado: "aceptada" }).eq("id", s.id);
      setItems((xs) => xs.filter((x) => x.id !== s.id));
      return toast.success("Fuente enlazada");
    }

    const insert: any = {
      user_id: user.id,
      nombres: p.nombres ?? s.titulo.split(" ")[0] ?? "Sin nombre",
      apellidos: p.apellidos ?? "Sin apellido",
      sexo: p.sexo || null,
      nac_fecha: p.nac_fecha || null,
      defuncion_fecha: p.defuncion_fecha || null,
      ocupacion: p.ocupacion || null,
      notas: [p.notas, p.documento_titulo ? `Importado de: ${p.documento_titulo}` : null].filter(Boolean).join("\n") || null,
      viva: p.defuncion_fecha ? "no" : "desconocido",
      certeza: "probable",
    };
    const { error } = await supabase.from("personas").insert(insert);
    if (error) return toast.error(error.message);
    await supabase.from("sugerencias").update({ estado: "aceptada" }).eq("id", s.id);
    setItems((xs) => xs.filter((x) => x.id !== s.id));
    toast.success(`Añadida ${insert.nombres} ${insert.apellidos}`);
  };

  const rechazar = async (id: string) => {
    await supabase.from("sugerencias").update({ estado: "rechazada" }).eq("id", id);
    setItems((xs) => xs.filter((x) => x.id !== id));
  };

  const aceptarSeleccionadas = async () => {
    const ids = Array.from(selected);
    const toAccept = items.filter((x) => ids.includes(x.id));
    if (!toAccept.length) return;
    toast.loading(`Añadiendo ${toAccept.length} personas…`, { id: "bulk" });
    let ok = 0;
    for (const s of toAccept) {
      try { await aceptar(s); ok++; } catch (_) {}
    }
    setSelected(new Set());
    toast.dismiss("bulk");
    toast.success(`${ok}/${toAccept.length} añadidas al árbol`);
  };

  const rechazarSeleccionadas = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    await supabase.from("sugerencias").update({ estado: "rechazada" }).in("id", ids);
    setItems((xs) => xs.filter((x) => !selected.has(x.id)));
    setSelected(new Set());
    toast.success(`${ids.length} descartadas`);
  };

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const lower = q.toLowerCase();
    return items.filter((s) => s.titulo.toLowerCase().includes(lower) || (s.descripcion ?? "").toLowerCase().includes(lower));
  }, [items, q]);

  // Agrupar por documento origen
  const groups = useMemo(() => {
    const m = new Map<string, Sugerencia[]>();
    for (const s of filtered) {
      const key = (s.payload?.documento_titulo as string) ?? (s.origen ?? "Sin origen");
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const toggleAllOfGroup = (key: string, on: boolean) => {
    const ids = (groups.find((g) => g[0] === key)?.[1] ?? []).map((s) => s.id);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) on ? next.add(id) : next.delete(id);
      return next;
    });
  };

  return (
    <div>
      <PageHeader
        title="Sugerencias"
        subtitle="Personas detectadas en tus documentos por la IA. Decide cuáles añadir a tu árbol."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={extraer} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Analizar documentos
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre o lugar…" className="pl-9" />
        </div>
        {selected.size > 0 && (
          <>
            <Badge variant="secondary">{selected.size} seleccionadas</Badge>
            <Button size="sm" onClick={aceptarSeleccionadas}><Check className="h-4 w-4" /> Añadir al árbol</Button>
            <Button size="sm" variant="outline" onClick={rechazarSeleccionadas}><X className="h-4 w-4" /> Descartar</Button>
          </>
        )}
      </div>

      {loading ? (
        <div className="grid min-h-[40vh] place-items-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card className="archivo-card">
          <CardContent className="py-16 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Sin sugerencias pendientes</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sube documentos en <Link to="/documentos" className="underline">Documentos</Link> y pulsa
              <strong> "Analizar documentos"</strong> para que la IA extraiga personas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([key, list]) => {
            const open = groupOpen[key] !== false;
            const allSel = list.every((s) => selected.has(s.id));
            return (
              <Card key={key} className="archivo-card overflow-hidden">
                <button
                  onClick={() => setGroupOpen((g) => ({ ...g, [key]: !open }))}
                  className="flex w-full items-center justify-between gap-3 border-b border-border/40 bg-foreground/5 px-4 py-3 text-left"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate font-semibold">{key}</span>
                    <Badge variant="secondary" className="ml-1">{list.length}</Badge>
                  </div>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <CardContent className="space-y-1 p-2">
                    <label className="mb-1 flex cursor-pointer items-center gap-2 px-3 py-1 text-xs text-muted-foreground">
                      <Checkbox checked={allSel} onCheckedChange={(v) => toggleAllOfGroup(key, !!v)} />
                      Seleccionar todas las de este documento
                    </label>
                    {list.map((s) => {
                      const sel = selected.has(s.id);
                      return (
                        <div
                          key={s.id}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors ${sel ? "bg-primary/8" : "hover:bg-foreground/5"}`}
                        >
                          <Checkbox
                            checked={sel}
                            onCheckedChange={(v) => setSelected((prev) => {
                              const n = new Set(prev);
                              v ? n.add(s.id) : n.delete(s.id);
                              return n;
                            })}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <span className="font-medium">{s.titulo}</span>
                              <Badge variant="outline" className="text-[10px]">{s.confianza}%</Badge>
                            </div>
                            {s.descripcion && (
                              <div className="text-xs text-muted-foreground">{s.descripcion}</div>
                            )}
                          </div>
                          <Button size="sm" variant="outline" onClick={() => aceptar(s)} title="Añadir al árbol">
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => rechazar(s.id)} title="Descartar">
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
