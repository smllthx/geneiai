import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

interface Pista { persona: string; texto: string; }

export default function Pistas() {
  const [pistas, setPistas] = useState<Pista[]>([]);
  useEffect(() => {
    (async () => {
      const [{ data: ps }, { data: ev }, { data: lg }] = await Promise.all([
        supabase.from("personas").select("*"),
        supabase.from("eventos").select("*"),
        supabase.from("lugares").select("*"),
      ]);
      const lugById = new Map((lg ?? []).map((l) => [l.id, l]));
      const out: Pista[] = [];
      for (const p of ps ?? []) {
        const nombre = `${p.nombres} ${p.apellidos}`;
        const evs = (ev ?? []).filter((e) => e.persona_id === p.id);
        if (evs.some((e) => e.tipo === "inmigracion")) out.push({ persona: nombre, texto: "Tiene evento de inmigración: buscar listas de pasajeros del puerto y año correspondientes." });
        const lNac = p.nac_lugar_id ? lugById.get(p.nac_lugar_id) : null;
        if (lNac?.pais?.toLowerCase().includes("italia") || lNac?.region?.toLowerCase().includes("liguria"))
          out.push({ persona: nombre, texto: "Origen italiano/Liguria: buscar registros parroquiales y comunales italianos (Antenati, FamilySearch Italia)." });
        if (evs.some((e) => e.lugar_original?.toLowerCase().includes("chile")) || p.nacionalidad?.toLowerCase().includes("chile"))
          out.push({ persona: nombre, texto: "Aparece en Chile: buscar Registro Civil chileno, cementerios, prensa histórica y FamilySearch Chile." });
        if (p.matrimonio_fecha) {
          const y = new Date(p.matrimonio_fecha).getUTCFullYear();
          out.push({ persona: nombre, texto: `Matrimonio en ${y}: buscar nacimientos de hijos entre ${y} y ${y + 20}.` });
        }
        if (p.defuncion_fecha) out.push({ persona: nombre, texto: `Defunción registrada: buscar entierro / cementerio / esquela.` });
      }
      setPistas(out);
    })();
  }, []);
  return (
    <div>
      <PageHeader title="Pistas relacionadas" subtitle="Sugerencias automáticas según los eventos y lugares ya registrados." />
      {pistas.length === 0 ? <p className="text-muted-foreground">Aún no hay pistas. Registra eventos y lugares para activarlas.</p> :
        <div className="grid gap-2">{pistas.map((p, i) => (
          <Card key={i} className="archivo-card"><CardContent className="pt-4 text-sm"><strong className="font-serif">{p.persona}</strong> — {p.texto}</CardContent></Card>
        ))}</div>}
    </div>
  );
}
