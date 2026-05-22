import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Languages, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  nombres?: string | null;
  apellidos?: string | null;
  origen?: string | null;
  nacionalidad?: string | null;
  onApply?: (v: { idioma: string; nombres: string; apellidos: string }) => void;
}

const LABEL: Record<string, string> = { es: "Español", it: "Italiano", de: "Alemán", en: "Inglés" };
const FLAG: Record<string, string> = { es: "🇪🇸", it: "🇮🇹", de: "🇩🇪", en: "🇬🇧" };

export default function NombresMultilingues({ nombres, apellidos, origen, nacionalidad, onApply }: Props) {
  const [loading, setLoading] = useState(false);
  const [principal, setPrincipal] = useState<string>("es");
  const [variantes, setVariantes] = useState<Array<{ idioma: string; nombres: string; apellidos: string; notas?: string }>>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const cargar = async () => {
    if (!nombres?.trim() && !apellidos?.trim()) return toast.error("Falta nombre");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("traducir-nombres", {
        body: { nombres, apellidos, origen, nacionalidad },
      });
      if (error) throw error;
      setPrincipal(data?.principal ?? "es");
      setVariantes(data?.variantes ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Error consultando IA");
    } finally {
      setLoading(false);
    }
  };

  const copy = async (txt: string, key: string) => {
    try { await navigator.clipboard.writeText(txt); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch (_) {}
  };

  return (
    <Card className="archivo-card">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="font-serif text-lg flex items-center gap-2"><Languages className="h-4 w-4" /> Nombre en otros idiomas</CardTitle>
        <Button size="sm" variant="outline" onClick={cargar} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sugerir"}
        </Button>
      </CardHeader>
      <CardContent className="pt-0 text-sm">
        {variantes.length === 0 ? (
          <p className="text-muted-foreground text-xs">La IA propondrá las equivalencias en español, italiano, alemán e inglés según el origen ({origen || nacionalidad || "—"}).</p>
        ) : (
          <ul className="space-y-2">
            {variantes.map((v) => {
              const txt = `${v.nombres} ${v.apellidos}`.trim();
              return (
                <li key={v.idioma} className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 ${v.idioma === principal ? "border-primary/60 bg-primary/5" : "border-border/60"}`}>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">{FLAG[v.idioma]} {LABEL[v.idioma] ?? v.idioma}{v.idioma === principal ? " · principal" : ""}</div>
                    <div className="font-medium truncate">{txt}</div>
                    {v.notas && <div className="text-[11px] text-muted-foreground truncate">{v.notas}</div>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => copy(txt, v.idioma)} title="Copiar">
                      {copied === v.idioma ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                    {onApply && (
                      <Button size="sm" variant="outline" onClick={() => onApply(v)} title="Usar como nombre principal">
                        Usar
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
