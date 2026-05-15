import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/glass";

export default function FamilySearchCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const code = params.get("code");
      const err = params.get("error");
      if (err) { setStatus("error"); setMsg(err); return; }
      if (!code) { setStatus("error"); setMsg("Falta código de autorización"); return; }
      try {
        const redirectUri = `${window.location.origin}/familysearch/callback`;
        const { data, error } = await supabase.functions.invoke("familysearch-auth", {
          body: { action: "exchange", code, redirect_uri: redirectUri },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setStatus("ok");
        setTimeout(() => navigate("/importar"), 1500);
      } catch (e: any) {
        setStatus("error");
        setMsg(e.message ?? "Error al conectar");
      }
    })();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <GlassCard className="max-w-md text-center">
        {status === "loading" && (<>
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="mt-4">Conectando con FamilySearch…</p>
        </>)}
        {status === "ok" && (<>
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-4">¡Cuenta conectada! Redirigiendo…</p>
        </>)}
        {status === "error" && (<>
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-4 font-medium">No se pudo conectar</p>
          <p className="mt-1 text-sm text-muted-foreground">{msg}</p>
          <Button className="mt-4" onClick={() => navigate("/importar")}>Volver a Importar</Button>
        </>)}
      </GlassCard>
    </div>
  );
}
