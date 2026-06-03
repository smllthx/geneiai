import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/glass";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Scan, Sparkles, Loader2, Users, Camera, ShieldAlert } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { compararRasgos, estimacionGenetica, parentescoFraccion } from "@/lib/parecido";

type Persona = { id: string; nombres: string; apellidos: string; foto_url: string | null };
type Rasgo = { id: string; persona_id: string; foto_url: string; rasgos: any; resumen: string | null; created_at: string };

export default function Parecidos() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [rasgos, setRasgos] = useState<Rasgo[]>([]);
  const [relaciones, setRelaciones] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [compareWith, setCompareWith] = useState<string>("");
  const [running, setRunning] = useState<string | null>(null);

  const load = async () => {
    const [{ data: p }, { data: r }, { data: rel }] = await Promise.all([
      supabase.from("personas").select("id, nombres, apellidos, foto_url").order("apellidos"),
      supabase.from("rasgos_faciales").select("*").order("created_at", { ascending: false }),
      supabase.from("relaciones").select("persona_id, pariente_id, tipo"),
    ]);
    setPersonas((p ?? []) as Persona[]);
    setRasgos((r ?? []) as Rasgo[]);
    setRelaciones(rel ?? []);
    if (!selected && p && p.length) setSelected(p[0].id);
    if (!compareWith && p && p.length > 1) setCompareWith(p[1].id);
  };
  useEffect(() => { load(); }, []);

  const rasgosByPersona = useMemo(() => {
    const m: Record<string, Rasgo> = {};
    for (const r of rasgos) if (!m[r.persona_id]) m[r.persona_id] = r;
    return m;
  }, [rasgos]);

  const analizar = async (persona: Persona) => {
    if (!persona.foto_url) { toast.error("Esta persona no tiene foto principal"); return; }
    setRunning(persona.id);
    try {
      const { data, error } = await supabase.functions.invoke("analizar-rostro", {
        body: { persona_id: persona.id, foto_url: persona.foto_url },
      });
      if (error) throw error;
      toast.success("Rasgos extraídos");
      await load();
    } catch (e: any) { toast.error(e.message ?? "Error al analizar"); }
    finally { setRunning(null); }
  };

  // Para la persona seleccionada, calcular parecidos con el resto.
  const parecidos = useMemo(() => {
    if (!selected || !rasgosByPersona[selected]) return [];
    const baseRasgos = rasgosByPersona[selected].rasgos ?? {};
    const out: any[] = [];
    for (const other of personas) {
      if (other.id === selected) continue;
      const otroRasgo = rasgosByPersona[other.id];
      if (!otroRasgo) continue;
      const { score, comunes } = compararRasgos(baseRasgos, otroRasgo.rasgos ?? {});
      // Parentesco esperado si existe relación directa
      const rel = relaciones.find(
        (r) => (r.persona_id === selected && r.pariente_id === other.id) ||
               (r.persona_id === other.id && r.pariente_id === selected),
      );
      const parentesco = rel ? parentescoFraccion(rel.tipo) : null;
      const adn = estimacionGenetica(parentesco, score);
      out.push({ persona: other, score, comunes, parentesco: rel?.tipo ?? null, adn });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 10);
  }, [selected, rasgosByPersona, personas, relaciones]);

  const personaSel = personas.find((p) => p.id === selected);
  const personaCompare = personas.find((p) => p.id === compareWith);
  const rasgosSel = selected ? rasgosByPersona[selected] : null;
  const rasgosCompare = compareWith ? rasgosByPersona[compareWith] : null;
  const directRel = relaciones.find(
    (r) => (r.persona_id === selected && r.pariente_id === compareWith) ||
           (r.persona_id === compareWith && r.pariente_id === selected),
  );
  const directComparison = rasgosSel && rasgosCompare
    ? compararRasgos(rasgosSel.rasgos ?? {}, rasgosCompare.rasgos ?? {})
    : null;
  const directAdn = directComparison
    ? estimacionGenetica(parentescoFraccion(directRel?.tipo), directComparison.score)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Laboratorio de fotos y parecidos" subtitle="Compara retratos familiares, rasgos visibles no sensibles, fecha probable y evidencia genealógica." />

      <GlassCard className="border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex gap-3 text-sm">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-muted-foreground">
            La app no afirma etnia, raza u origen biológico por una cara. Analiza rasgos fenotípicos visibles, ropa, época, ambiente y parecido familiar como hipótesis; la prueba genealógica debe venir de fuentes, relaciones y documentos.
          </p>
        </div>
      </GlassCard>

      <GlassCard className="space-y-4 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold"><Scan className="h-4 w-4" /> Analizar fotos</div>
        <p className="text-xs text-muted-foreground">Selecciona personas con foto principal y extrae sus rasgos.</p>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {personas.filter((p) => p.foto_url).map((p) => {
            const hecho = !!rasgosByPersona[p.id];
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-xl bg-foreground/5 p-2">
                <img src={p.foto_url!} alt={p.nombres} className="h-12 w-12 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.nombres} {p.apellidos}</p>
                  <p className="text-[10px] text-muted-foreground">{hecho ? "Analizada" : "Sin analizar"}</p>
                </div>
                <Button size="sm" variant={hecho ? "ghost" : "default"} disabled={running === p.id} onClick={() => analizar(p)}>
                  {running === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : hecho ? "Repetir" : "Analizar"}
                </Button>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard className="space-y-4 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold"><Camera className="h-4 w-4" /> Comparación directa A/B</div>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <PhotoCompareColumn label="Persona A" value={selected} onChange={setSelected} personas={personas} rasgo={rasgosSel} persona={personaSel} analizar={analizar} running={running} />
          <div className="flex items-center justify-center">
            <div className="rounded-3xl border border-border bg-foreground/5 px-5 py-4 text-center">
              <div className="text-4xl font-black tabular-nums">{directComparison ? `${directComparison.score}%` : "--"}</div>
              <div className="text-xs text-muted-foreground">parecido visual</div>
              <div className="mt-2 text-sm font-semibold">{directRel?.tipo ? `Relación: ${directRel.tipo}` : "Sin relación directa registrada"}</div>
              <div className="text-xs text-muted-foreground">ADN estimado: {directAdn !== null ? `${(directAdn * 100).toFixed(1)}%` : "--"}</div>
            </div>
          </div>
          <PhotoCompareColumn label="Persona B" value={compareWith} onChange={setCompareWith} personas={personas} rasgo={rasgosCompare} persona={personaCompare} analizar={analizar} running={running} />
        </div>
        {directComparison && (
          <div className="rounded-xl bg-foreground/5 p-3 text-sm">
            <p className="font-semibold">Rasgos compartidos detectados</p>
            {directComparison.comunes.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {directComparison.comunes.map((c: any) => (
                  <span key={`${c.rasgo}-${c.valor}`} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                    {c.rasgo.replace(/_/g, " ")}: {c.valor}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-muted-foreground">No hay suficientes rasgos coincidentes o ambas fotos necesitan análisis.</p>
            )}
          </div>
        )}
      </GlassCard>

      <GlassCard className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" /> Ranking de parecidos familiares</div>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-[260px]"><SelectValue placeholder="Persona base" /></SelectTrigger>
            <SelectContent>
              {personas.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nombres} {p.apellidos}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!rasgosSel && <p className="text-sm text-muted-foreground">Analiza la foto de {personaSel?.nombres ?? "esta persona"} primero.</p>}

        {rasgosSel && (
          <>
            <div className="rounded-xl bg-foreground/5 p-3 text-xs">
              <p className="mb-1 font-semibold">Análisis de foto y rasgos de {personaSel?.nombres}</p>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {Object.entries(rasgosSel.rasgos ?? {}).filter(([k]) => k !== "resumen" && k !== "rasgos_distintivos").map(([k, v]) => (
                  <div key={k} className="text-muted-foreground"><span className="font-medium text-foreground">{k.replace(/_/g, " ")}:</span> {String(v)}</div>
                ))}
              </div>
              {rasgosSel.resumen && <p className="mt-2 italic text-muted-foreground">{rasgosSel.resumen}</p>}
              <p className="mt-2 text-muted-foreground">
                Próximo paso sugerido: comparar con familiares de la rama paterna y materna, y confirmar con fuentes documentales.
              </p>
            </div>

            <div className="space-y-2">
              {parecidos.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay otras personas analizadas para comparar.</p>}
              {parecidos.map((p) => (
                <Link key={p.persona.id} to={`/personas/${p.persona.id}`} className="flex items-center gap-3 rounded-xl bg-foreground/5 p-2 transition hover:bg-foreground/10">
                  {p.persona.foto_url ? <img src={p.persona.foto_url} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <div className="h-12 w-12 rounded-lg bg-foreground/10" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.persona.nombres} {p.persona.apellidos}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.parentesco ? `${p.parentesco} · ` : ""}{p.comunes.length} rasgos comunes · ADN estim. {(p.adn * 100).toFixed(1)}%
                    </p>
                    {p.comunes.length > 0 && (
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {p.comunes.map((c: any) => `${c.rasgo}: ${c.valor}`).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold tabular-nums">{p.score}%</div>
                    <div className="text-[10px] text-muted-foreground">parecido</div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </GlassCard>
    </div>
  );
}

function PhotoCompareColumn({ label, value, onChange, personas, persona, rasgo, analizar, running }: any) {
  return (
    <div className="rounded-3xl border border-border bg-foreground/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        {persona && <Button size="sm" variant="outline" disabled={running === persona.id || !persona.foto_url} onClick={() => analizar(persona)}>
          {running === persona.id ? <Loader2 className="h-3 w-3 animate-spin" /> : rasgo ? "Reanalizar" : "Analizar"}
        </Button>}
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Seleccionar persona" /></SelectTrigger>
        <SelectContent>
          {personas.map((p: Persona) => (
            <SelectItem key={p.id} value={p.id}>{p.nombres} {p.apellidos}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="mt-4 overflow-hidden rounded-3xl bg-black/20">
        {persona?.foto_url ? (
          <img src={persona.foto_url} alt="" className="h-72 w-full object-cover" />
        ) : (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Sin retrato principal</div>
        )}
      </div>
      <div className="mt-3">
        <p className="font-semibold">{persona ? `${persona.nombres} ${persona.apellidos}` : "Selecciona persona"}</p>
        <p className="text-xs text-muted-foreground">{rasgo ? "Rasgos IA disponibles" : "Pendiente de análisis"}</p>
      </div>
    </div>
  );
}
