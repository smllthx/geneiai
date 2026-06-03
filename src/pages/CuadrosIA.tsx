import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, FileText, Image, MapPinned, Printer, Sparkles, UserRound, Users } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { personaCode } from "@/lib/personaCode";

const TEMPLATES = [
  { title: "Ficha visual de persona", icon: UserRound, desc: "Retrato, fechas, lugares, padres, cónyuge, hijos y fuentes." },
  { title: "Cuadro familiar", icon: Users, desc: "Pareja, matrimonio, hijos, lugares principales y línea familiar." },
  { title: "Póster de antepasado", icon: Image, desc: "Foto, cronología breve, mapa de vida y origen familiar." },
  { title: "Línea de tiempo visual", icon: FileText, desc: "Nacimiento, matrimonio, migraciones, defunción y entierro." },
  { title: "Mapa migratorio", icon: MapPinned, desc: "Lugares importantes y ruta de vida con eventos asociados." },
  { title: "Origen ancestral", icon: Sparkles, desc: "Países, regiones y porcentajes documentales." },
];

export default function CuadrosIA() {
  const [personas, setPersonas] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [searchParams] = useSearchParams();
  const personaParam = searchParams.get("persona");

  useEffect(() => {
    (async () => {
      const selectCols = "id,nombres,apellidos,nac_fecha,defuncion_fecha,foto_url,notas";
      const { data } = await supabase.from("personas").select(selectCols).order("updated_at", { ascending: false }).limit(24);
      let rows = data ?? [];
      let initial = personaParam ? rows.find((p) => p.id === personaParam) : null;
      if (personaParam && !initial) {
        const { data: exact } = await supabase.from("personas").select(selectCols).eq("id", personaParam).maybeSingle();
        if (exact) {
          initial = exact;
          rows = [exact, ...rows.filter((p) => p.id !== exact.id)];
        }
      }
      setPersonas(rows);
      setSelected(initial ?? rows[0] ?? null);
    })();
  }, [personaParam]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cuadros IA"
        subtitle="Generador visual de antepasados. Separa hechos, datos faltantes e hipótesis; no debe inventar información."
      />

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader><CardTitle>Persona base</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {personas.length === 0 && (
              <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">
                No encontré personas para generar cuadros. Revisa que la ficha exista y que tengas acceso.
              </p>
            )}
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:bg-muted ${selected?.id === p.id ? "border-primary bg-primary/5" : ""}`}
              >
                <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-muted text-xs font-semibold">
                  {p.foto_url ? <img src={p.foto_url} alt="" className="h-full w-full object-cover" /> : `${p.nombres?.[0] ?? ""}${p.apellidos?.[0] ?? ""}`}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{p.nombres} {p.apellidos}</span>
                  <span className="text-xs text-muted-foreground">ID {personaCode(p.id)}</span>
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Vista previa editable</CardTitle></CardHeader>
            <CardContent>
              <div className="mx-auto max-w-xl rounded-3xl border bg-gradient-to-br from-white via-emerald-50 to-violet-50 p-8 text-center shadow-sm">
                <div className="mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-white text-xl font-semibold ring-1 ring-border">
                  {selected?.foto_url ? <img src={selected.foto_url} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-8 w-8 text-muted-foreground" />}
                </div>
                <h2 className="mt-4 text-3xl font-semibold">{selected ? `${selected.nombres} ${selected.apellidos}` : "Selecciona una persona"}</h2>
                <p className="mt-1 text-muted-foreground">{selected?.nac_fecha?.slice(0, 4) ?? "Nacimiento no registrado"}-{selected?.defuncion_fecha?.slice(0, 4) ?? "Vive o sin dato"}</p>
                <div className="mt-6 rounded-2xl bg-white/70 p-4 text-left text-sm text-muted-foreground">
                  <strong className="text-foreground">Resumen IA:</strong> preparado para generar una biografía basada solo en datos, fuentes e hipótesis marcadas.
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button><Sparkles className="h-4 w-4" /> Generar con IA</Button>
                <Button variant="outline"><Download className="h-4 w-4" /> PNG/PDF</Button>
                <Button variant="outline"><Printer className="h-4 w-4" /> Imprimir</Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {TEMPLATES.map(({ title, icon: Icon, desc }) => (
              <Card key={title}>
                <CardContent className="p-4">
                  <Icon className="mb-3 h-5 w-5 text-primary" />
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
