import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function CoincidenciasWebButton({ personaId }: { personaId: string }) {
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    const t = toast.loading("Buscando coincidencias en internet…");
    try {
      const { data, error } = await supabase.functions.invoke("coincidencias-fuentes-web", { body: { persona_id: personaId } });
      if (error) throw error;
      toast.dismiss(t);
      toast.success(`${data?.creadas ?? 0} fuentes sugeridas`, {
        description: "Revísalas en Sugerencias",
        action: { label: "Ver", onClick: () => (window.location.href = "/sugerencias") },
      });
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message ?? "Error al buscar");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button size="sm" variant="outline" onClick={run} disabled={loading} className="gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
      Coincidencias en internet
    </Button>
  );
}
