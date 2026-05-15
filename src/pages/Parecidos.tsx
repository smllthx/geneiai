import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/glass";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Scan, Sparkles, Loader2, Users } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { compararRasgos, estimacionGenetica, parentescoFraccion } from "@/lib/parecido";

type Persona = { id: string; nombres: string; apellidos: string; foto_url: string | null };
type Rasgo = { id: string; persona_id: string; foto_url: string; rasgos: any; resumen: string | null; created_at: string };

export default function Parecidos() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [rasgos, setRasgos] = useState<Rasgo[]>([]);
  const [relaciones, setRelaciones] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
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
  const rasgosSel = selected ? rasgosByPersona[selected] : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Rasgos faciales y parecidos" subtitle="Análisis IA de fotos + estimación de parentesco visual." />

      <GlassCard className="space-y-4 p-4">
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

      <GlassCard className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" /> Parecidos</div>
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
              <p className="mb-1 font-semibold">Rasgos detectados</p>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {Object.entries(rasgosSel.rasgos ?? {}).filter(([k]) => k !== "resumen" && k !== "rasgos_distintivos").map(([k, v]) => (
                  <div key={k} className="text-muted-foreground"><span className="font-medium text-foreground">{k.replace(/_/g, " ")}:</span> {String(v)}</div>
                ))}
              </div>
              {rasgosSel.resumen && <p className="mt-2 italic text-muted-foreground">{rasgosSel.resumen}</p>}
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
