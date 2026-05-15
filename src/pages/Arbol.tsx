import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader } from "@/components/glass";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PersonCard, EmptySlot, type PersonaLite } from "@/components/PersonCard";
import QuickAddRelative from "@/components/QuickAddRelative";
import { Crosshair, ZoomIn, ZoomOut } from "lucide-react";

export default function Arbol() {
  const [personas, setPersonas] = useState<PersonaLite[]>([]);
  const [rels, setRels] = useState<any[]>([]);
  const [center, setCenter] = useState<string>("");
  const [generaciones, setGeneraciones] = useState(4);
  const [zoom, setZoom] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("personas").select("id,nombres,apellidos,sexo,nac_fecha,nac_rango_ini,defuncion_fecha,viva").order("apellidos"),
        supabase.from("relaciones").select("id,persona_id,pariente_id,tipo"),
      ]);
      setPersonas((p as any) ?? []);
      setRels(r ?? []);
      if (!center && p?.[0]) setCenter(p[0].id);
    })();
  }, [reloadKey]);

  const byId = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas]);

  // Find parents for a given person id
  const padresDe = (pid: string) => {
    const padreIds = rels
      .filter((r) => r.persona_id === pid && (r.tipo === "padre" || r.tipo === "madre"))
      .map((r) => ({ id: r.pariente_id, tipo: r.tipo }));
    const padre = padreIds.find((x) => {
      const per = byId.get(x.id);
      return x.tipo === "padre" || (per && per.sexo === "masculino");
    });
    const madre = padreIds.find((x) => {
      const per = byId.get(x.id);
      return x.tipo === "madre" || (per && per.sexo === "femenino");
    });
    return {
      padre: padre ? byId.get(padre.id) : undefined,
      madre: madre ? byId.get(madre.id) : undefined,
    };
  };

  const conyugesDe = (pid: string) =>
    rels.filter((r) => (r.persona_id === pid || r.pariente_id === pid) && r.tipo === "conyuge")
      .map((r) => byId.get(r.persona_id === pid ? r.pariente_id : r.persona_id))
      .filter(Boolean) as PersonaLite[];

  const hijosDe = (pid: string) => {
    const ids = new Set<string>();
    for (const r of rels) {
      if (r.pariente_id === pid && (r.tipo === "padre" || r.tipo === "madre")) ids.add(r.persona_id);
      if (r.persona_id === pid && r.tipo === "hijo") ids.add(r.pariente_id);
    }
    return [...ids].map((i) => byId.get(i)).filter(Boolean) as PersonaLite[];
  };

  const reload = () => setReloadKey((k) => k + 1);
  const persona = center ? byId.get(center) : undefined;

  // Recursive ascendants renderer
  const Ascendants = ({ pid, gen }: { pid: string; gen: number }) => {
    if (gen <= 0) return null;
    const { padre, madre } = padresDe(pid);
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap items-end justify-center gap-3">
          <div className="flex flex-col items-center gap-2">
            {padre ? <Ascendants pid={padre.id} gen={gen - 1} /> : null}
            {padre ? (
              <PersonCard p={padre} compact />
            ) : (
              <QuickAddRelative
                personaId={pid}
                defaultTipo="padre"
                onAdded={reload}
                trigger={<button className="block"><EmptySlot label="padre" onClick={() => {}} /></button>}
              />
            )}
          </div>
          <div className="flex flex-col items-center gap-2">
            {madre ? <Ascendants pid={madre.id} gen={gen - 1} /> : null}
            {madre ? (
              <PersonCard p={madre} compact />
            ) : (
              <QuickAddRelative
                personaId={pid}
                defaultTipo="madre"
                onAdded={reload}
                trigger={<button className="block"><EmptySlot label="madre" onClick={() => {}} /></button>}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Árbol familiar"
        subtitle="Persona central abajo, ancestros hacia arriba sin límite de generaciones."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <Select value={center} onValueChange={setCenter}>
            <SelectTrigger><SelectValue placeholder="Elegir persona central" /></SelectTrigger>
            <SelectContent>
              {personas.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nombres} {p.apellidos}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Select value={String(generaciones)} onValueChange={(v) => setGeneraciones(parseInt(v))}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2, 3, 4, 5, 6, 8, 10].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} generaciones</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} aria-label="Alejar"><ZoomOut className="h-4 w-4" /></Button>
        <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))} aria-label="Acercar"><ZoomIn className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={() => setZoom(1)}><Crosshair className="h-4 w-4" /> Centrar</Button>
      </div>

      {!persona ? (
        <p className="text-muted-foreground">Selecciona una persona o crea la primera en Personas.</p>
      ) : (
        <div className="overflow-x-auto pb-24 md:pb-8">
          <div
            className="mx-auto flex flex-col items-center gap-6 origin-top transition-transform"
            style={{ transform: `scale(${zoom})`, minWidth: "max-content" }}
          >
            <Ascendants pid={persona.id} gen={generaciones} />

            <div className="flex flex-wrap items-center justify-center gap-3">
              <PersonCard p={persona} highlighted />
              {conyugesDe(persona.id).map((c) => (
                <PersonCard key={c.id} p={c} />
              ))}
              <QuickAddRelative
                personaId={persona.id}
                defaultTipo="conyuge"
                onAdded={reload}
                trigger={<button className="block"><EmptySlot label="cónyuge" onClick={() => {}} /></button>}
              />
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {hijosDe(persona.id).map((h) => (
                <PersonCard key={h.id} p={h} compact />
              ))}
              <QuickAddRelative
                personaId={persona.id}
                defaultTipo="hijo"
                onAdded={reload}
                trigger={<button className="block"><EmptySlot label="hijo/a" onClick={() => {}} /></button>}
              />
            </div>

            <Link to={`/personas/${persona.id}`} className="text-sm text-link underline">
              Ver ficha completa →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
