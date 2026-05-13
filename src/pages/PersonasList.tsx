import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import CertezaBadge from "@/components/CertezaBadge";
import { Plus, EyeOff } from "lucide-react";

export default function PersonasList() {
  const navigate = useNavigate();
  const [personas, setPersonas] = useState<any[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("personas").select("*").order("apellidos");
      setPersonas(data ?? []);
    })();
  }, []);

  const filtered = personas.filter((p) =>
    `${p.nombres} ${p.apellidos}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Personas"
        subtitle="Toda persona del archivo. Las personas vivas se mantienen privadas dentro de tu cuenta."
        actions={<Button onClick={() => navigate("/personas/nueva")}><Plus className="h-4 w-4" /> Nueva persona</Button>}
      />
      <Input placeholder="Buscar por nombre o apellido…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-md" />
      {filtered.length === 0 ? (
        <Card className="archivo-card"><CardContent className="py-12 text-center text-muted-foreground">
          Aún no hay personas registradas. Comienza con la primera ficha.
        </CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((p) => (
            <button key={p.id} onClick={() => navigate(`/personas/${p.id}`)}
              className="archivo-card flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:border-primary/40">
              <div>
                <div className="font-serif text-lg">{p.nombres} <span className="font-medium">{p.apellidos}</span>
                  {p.viva === "si" && <span title="Persona viva — privada"><EyeOff className="ml-2 inline h-3.5 w-3.5 text-muted-foreground" /></span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.nac_fecha ? `n. ${new Date(p.nac_fecha).getUTCFullYear()}` : p.nac_rango_ini ? `n. ${p.nac_rango_ini}–${p.nac_rango_fin}` : "nacimiento s/d"}
                  {p.defuncion_fecha && ` — †${new Date(p.defuncion_fecha).getUTCFullYear()}`}
                </div>
              </div>
              <CertezaBadge value={p.certeza} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
