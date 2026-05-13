import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";

type Persona = { id: string; nombres: string; apellidos: string; nacionalidad: string | null };
type Rel = { persona_id: string; pariente_id: string; tipo: string };

const MAX_GEN = 5; // hasta tatara-tatara abuelos

function buildParents(rels: Rel[]) {
  const parents = new Map<string, { padre?: string; madre?: string }>();
  for (const r of rels) {
    if (r.tipo !== "padre" && r.tipo !== "madre") continue;
    const cur = parents.get(r.persona_id) ?? {};
    if (r.tipo === "padre") cur.padre = r.pariente_id;
    if (r.tipo === "madre") cur.madre = r.pariente_id;
    parents.set(r.persona_id, cur);
  }
  return parents;
}

// Recorre n generaciones y reparte pesos. Cada padre contribuye 1/2^gen.
function computeAncestry(focal: string, parents: Map<string, { padre?: string; madre?: string }>, byId: Map<string, Persona>) {
  const counts: Record<string, number> = {};
  let knownWeight = 0;
  const totalLeaves = Math.pow(2, MAX_GEN); // 32 ancestros en gen 5
  const queue: Array<{ id: string | undefined; gen: number; weight: number }> = [
    { id: parents.get(focal)?.padre, gen: 1, weight: 0.5 },
    { id: parents.get(focal)?.madre, gen: 1, weight: 0.5 },
  ];
  while (queue.length) {
    const { id, gen, weight } = queue.shift()!;
    if (!id) continue;
    if (gen === MAX_GEN) {
      // Hoja: contar nacionalidad
      const p = byId.get(id);
      const nac = (p?.nacionalidad || "").trim() || "Sin determinar";
      counts[nac] = (counts[nac] || 0) + weight;
      knownWeight += weight;
      continue;
    }
    const ps = parents.get(id);
    if (!ps?.padre && !ps?.madre) {
      // No hay más padres conocidos: usar la nacionalidad de este nodo como fallback
      const p = byId.get(id);
      const nac = (p?.nacionalidad || "").trim() || "Sin determinar";
      counts[nac] = (counts[nac] || 0) + weight;
      knownWeight += weight;
      continue;
    }
    queue.push({ id: ps.padre, gen: gen + 1, weight: weight / 2 });
    queue.push({ id: ps.madre, gen: gen + 1, weight: weight / 2 });
  }
  // Lo que falta llenar = "Sin determinar"
  const unknown = Math.max(0, 1 - knownWeight);
  if (unknown > 0) counts["Sin determinar"] = (counts["Sin determinar"] || 0) + unknown;
  // Convertir a porcentaje
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const pct = Object.entries(counts).map(([k, v]) => ({ origen: k, porcentaje: (v / total) * 100 }));
  pct.sort((a, b) => b.porcentaje - a.porcentaje);
  return { pct, totalLeaves };
}

export default function EstimacionEtnica() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [rels, setRels] = useState<Rel[]>([]);
  const [focalId, setFocalId] = useState<string>("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: ps }, { data: rs }] = await Promise.all([
        supabase.from("personas").select("id, nombres, apellidos, nacionalidad").order("apellidos"),
        supabase.from("relaciones").select("persona_id, pariente_id, tipo"),
      ]);
      setPersonas(ps ?? []);
      setRels((rs ?? []) as any);
      if (ps && ps.length && !focalId) setFocalId(ps[0].id);
    })();
  }, []);

  const byId = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas]);
  const parents = useMemo(() => buildParents(rels), [rels]);
  const result = useMemo(() => focalId ? computeAncestry(focalId, parents, byId) : null, [focalId, parents, byId]);

  const filtered = personas.filter((p) =>
    `${p.nombres} ${p.apellidos}`.toLowerCase().includes(filter.toLowerCase()),
  );

  const palette = ["bg-primary", "bg-accent", "bg-secondary", "bg-muted", "bg-primary/70", "bg-accent/70"];

  return (
    <div>
      <PageHeader
        title="Estimación étnica"
        subtitle={`Composición calculada sobre los ancestros conocidos hasta ${MAX_GEN} generaciones.`}
      />

      <Alert className="mb-6 border-accent/30 bg-accent/5">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Cómo se calcula</AlertTitle>
        <AlertDescription>
          Esto NO es un test genético. Es una proporción aritmética: cada padre aporta 1/2, cada abuelo 1/4, etc. Cuando falta un ancestro, su parte se cuenta como «Sin determinar». Cargá la nacionalidad/región en cada persona para mejorar el cálculo.
        </AlertDescription>
      </Alert>

      <Card className="archivo-card mb-6">
        <CardHeader><CardTitle className="font-serif text-xl">Persona focal</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Buscar</Label>
            <Input placeholder="Filtrar por nombre…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          <div>
            <Label>Persona</Label>
            <Select value={focalId} onValueChange={setFocalId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {filtered.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.apellidos}, {p.nombres}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className="archivo-card">
          <CardHeader><CardTitle className="font-serif text-xl">Composición estimada</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex h-6 w-full overflow-hidden rounded-md border border-border">
              {result.pct.map((seg, i) => (
                <div
                  key={seg.origen}
                  className={palette[i % palette.length]}
                  style={{ width: `${seg.porcentaje}%` }}
                  title={`${seg.origen}: ${seg.porcentaje.toFixed(1)}%`}
                />
              ))}
            </div>
            <ul className="divide-y divide-border">
              {result.pct.map((seg, i) => (
                <li key={seg.origen} className="flex items-center justify-between py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`inline-block h-3 w-3 rounded-sm ${palette[i % palette.length]}`} />
                    <span className="font-medium">{seg.origen}</span>
                  </span>
                  <span className="font-mono text-muted-foreground">{seg.porcentaje.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
