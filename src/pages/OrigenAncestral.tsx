import { useEffect, useMemo, useState } from "react";
import { BarChart3, Dna, MapPinned, Sparkles } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type OriginRow = {
  pais: string;
  region: string;
  lugar: string;
  count: number;
  apellidos: Set<string>;
};

export default function OrigenAncestral() {
  const [personas, setPersonas] = useState<any[]>([]);
  const [lugares, setLugares] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: l }] = await Promise.all([
        supabase.from("personas").select("id,nombres,apellidos,nac_lugar_id"),
        supabase.from("lugares").select("id,ciudad,provincia,region,pais"),
      ]);
      setPersonas(p ?? []);
      setLugares(l ?? []);
    })();
  }, []);

  const origin = useMemo(() => {
    const byPlace = new Map(lugares.map((l) => [l.id, l]));
    const map = new Map<string, OriginRow>();
    for (const person of personas) {
      const place = byPlace.get(person.nac_lugar_id);
      if (!place) continue;
      const pais = place.pais || "País no registrado";
      const region = place.region || place.provincia || "Región no registrada";
      const lugar = [place.ciudad, region, pais].filter(Boolean).join(", ");
      const key = `${pais}|${region}|${lugar}`;
      const row = map.get(key) ?? { pais, region, lugar, count: 0, apellidos: new Set<string>() };
      row.count += 1;
      const surname = String(person.apellidos ?? "").split(/\s+/)[0];
      if (surname) row.apellidos.add(surname);
      map.set(key, row);
    }
    const total = [...map.values()].reduce((sum, row) => sum + row.count, 0);
    return { total, rows: [...map.values()].sort((a, b) => b.count - a.count) };
  }, [personas, lugares]);

  const coverage = personas.length ? Math.round((origin.total / personas.length) * 100) : 0;
  const confidence = coverage >= 80 ? "Alta" : coverage >= 50 ? "Media" : "Baja";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Origen ancestral"
        subtitle="Origen documental calculado solo desde lugares de nacimiento registrados. No inventa datos y separa árbol documental de ADN externo."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><MapPinned className="h-5 w-5" /> Mapa de origen</CardTitle></CardHeader>
          <CardContent>
            <div className="grid min-h-72 place-items-center rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-violet-50 text-center text-sm text-muted-foreground">
              Mapa preparado para países, regiones y rutas familiares.
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Confianza</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-4xl font-semibold">{coverage}%</p>
            <p className="text-sm text-muted-foreground">Cobertura documental: {origin.total} de {personas.length} personas con lugar de nacimiento.</p>
            <div className="rounded-2xl bg-muted p-3 text-sm">Nivel de confianza: <strong>{confidence}</strong></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Porcentaje documental por lugar</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {origin.rows.length === 0 && <p className="text-sm text-muted-foreground">Agrega lugares de nacimiento para calcular origen ancestral.</p>}
          {origin.rows.map((row) => {
            const pct = origin.total ? Math.round((row.count / origin.total) * 100) : 0;
            return (
              <div key={row.lugar} className="rounded-2xl border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.lugar}</p>
                    <p className="text-xs text-muted-foreground">{row.count} antepasado(s) · apellidos: {[...row.apellidos].slice(0, 5).join(", ") || "sin apellido"}</p>
                  </div>
                  <span className="text-lg font-semibold">{pct}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Dna className="h-5 w-5" /> ADN externo</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Permite ingresar resultados manuales de proveedores externos y compararlos con el origen documental.</p>
            <Button variant="outline">Agregar región genética</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Insights IA</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            La IA debe explicar diferencias entre árbol y ADN, detectar ramas sin lugar y sugerir antepasados prioritarios para investigar.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
