import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CertezaBadge from "@/components/CertezaBadge";

export default function Arbol() {
  const [personas, setPersonas] = useState<any[]>([]);
  const [rels, setRels] = useState<any[]>([]);
  const [center, setCenter] = useState<string>("");

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("personas").select("*").order("apellidos"),
        supabase.from("relaciones").select("*"),
      ]);
      setPersonas(p ?? []); setRels(r ?? []);
      if (p?.[0]) setCenter(p[0].id);
    })();
  }, []);

  const byId = new Map(personas.map((p) => [p.id, p]));
  const persona = byId.get(center);
  const padres = rels.filter((r) => r.persona_id === center && (r.tipo === "padre" || r.tipo === "madre")).map((r) => byId.get(r.pariente_id)).filter(Boolean);
  const conyuges = rels.filter((r) => r.persona_id === center && r.tipo === "conyuge").map((r) => byId.get(r.pariente_id)).filter(Boolean);
  const hijos = rels.filter((r) => r.pariente_id === center && r.tipo === "hijo").map((r) => byId.get(r.persona_id)).filter(Boolean);

  const Node = ({ p }: any) => (
    <button onClick={() => setCenter(p.id)} className="archivo-card px-3 py-2 text-left text-sm hover:border-primary/40 min-w-[160px]">
      <div className="font-serif">{p.nombres} {p.apellidos}</div>
      <div className="mt-1"><CertezaBadge value={p.certeza} /></div>
    </button>
  );

  return (
    <div>
      <PageHeader title="Árbol familiar" subtitle="Persona central, padres arriba, cónyuges al lado, hijos abajo. Haz clic para mover el centro." />
      <div className="mb-4 max-w-md">
        <Select value={center} onValueChange={setCenter}>
          <SelectTrigger><SelectValue placeholder="Elegir persona central" /></SelectTrigger>
          <SelectContent>{personas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombres} {p.apellidos}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {!persona ? <p className="text-muted-foreground">Selecciona una persona.</p> : (
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-wrap justify-center gap-3">{padres.length === 0 ? <span className="text-xs text-muted-foreground">(padres no registrados)</span> : padres.map((p: any) => <Node key={p.id} p={p} />)}</div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="archivo-card border-primary px-4 py-3"><div className="font-serif text-lg">{persona.nombres} {persona.apellidos}</div><CertezaBadge value={persona.certeza} /></div>
            {conyuges.map((c: any) => <Node key={c.id} p={c} />)}
          </div>
          <div className="flex flex-wrap justify-center gap-3">{hijos.length === 0 ? <span className="text-xs text-muted-foreground">(sin hijos registrados)</span> : hijos.map((h: any) => <Node key={h.id} p={h} />)}</div>
          <Link to={`/personas/${persona.id}`} className="text-sm text-link underline">Ver ficha completa →</Link>
        </div>
      )}
    </div>
  );
}
