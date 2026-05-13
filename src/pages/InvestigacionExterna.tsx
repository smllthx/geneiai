import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateExternalSearches } from "@/lib/external-searches";
import { Globe, Copy } from "lucide-react";
import { toast } from "sonner";

export default function InvestigacionExterna() {
  const [personas, setPersonas] = useState<any[]>([]);
  const [pid, setPid] = useState<string>("");
  useEffect(() => {
    supabase.from("personas").select("*").order("apellidos").then(({ data }) => {
      setPersonas(data ?? []); if (data?.[0]) setPid(data[0].id);
    });
  }, []);
  const persona = personas.find((p) => p.id === pid);
  const sugs = persona ? generateExternalSearches(persona) : [];

  return (
    <div>
      <PageHeader title="Investigación externa" subtitle="Genera búsquedas listas para FamilySearch, MyHeritage, Google y Google Books. Sin scraping: sólo enlaces y consultas preparadas." />
      {personas.length === 0 ? <p className="text-muted-foreground">Crea una persona primero.</p> : (
        <>
          <div className="mb-4 max-w-md">
            <Select value={pid} onValueChange={setPid}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{personas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombres} {p.apellidos}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {sugs.map((s, i) => (
              <Card key={i} className="archivo-card">
                <CardHeader className="pb-2"><CardTitle className="font-serif text-lg">{s.plataforma}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground">{s.objetivo}</p>
                  <code className="block break-all rounded bg-muted px-2 py-1 text-xs">{s.query}</code>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(s.query); toast.success("Copiado"); }}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
                    <Button size="sm" asChild><a href={s.url} target="_blank" rel="noopener noreferrer"><Globe className="h-3.5 w-3.5" /> Abrir</a></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
