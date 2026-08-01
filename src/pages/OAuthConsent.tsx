import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, ExternalLink, Loader2, LockKeyhole, ShieldCheck, X } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { hasDevicePasskey, isDeviceUnlocked } from "@/lib/devicePasskey";

type AuthorizationDetails = {
  authorization_id: string;
  redirect_uri: string;
  client: { id: string; name?: string; uri?: string; logo_uri?: string };
  user: { id: string; email: string };
  scope: string;
};

function isTrustedWorkRedirect(raw: string) {
  try {
    const url = new URL(raw);
    const callbackId = url.pathname.slice("/connector/oauth/".length);
    return url.protocol === "https:"
      && url.hostname === "chatgpt.com"
      && url.pathname.startsWith("/connector/oauth/")
      && callbackId.length >= 8
      && !callbackId.includes("/");
  } catch {
    return false;
  }
}

const scopeLabels: Record<string, string> = {
  openid: "Confirmar tu identidad",
  profile: "Ver tu perfil básico",
  email: "Ver el correo de tu cuenta",
  phone: "Ver el teléfono de tu cuenta",
  offline_access: "Mantener la conexión activa",
};

export default function OAuthConsent() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const authorizationId = useMemo(
    () => new URLSearchParams(location.search).get("authorization_id") ?? "",
    [location.search],
  );
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!user || (hasDevicePasskey() && !isDeviceUnlocked())) {
      const returnTo = `${location.pathname}${location.search}`;
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
      return;
    }

    if (!authorizationId) {
      setError("La solicitud de conexión no es válida o ya venció.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error: authError }) => {
      if (cancelled) return;
      if (authError || !data) {
        setError(authError?.message || "No pudimos comprobar esta solicitud de acceso.");
        setLoading(false);
        return;
      }
      if ("redirect_url" in data) {
        window.location.assign(data.redirect_url);
        return;
      }
      const authorization = data as AuthorizationDetails;
      if (!isTrustedWorkRedirect(authorization.redirect_uri)) {
        setError("Esta solicitud no proviene de una conexión oficial de ChatGPT Work.");
        setLoading(false);
        return;
      }
      setDetails(authorization);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [authorizationId, authLoading, location.pathname, location.search, navigate, user]);

  const decide = async (action: "approve" | "deny") => {
    if (!details) return;
    setSubmitting(action);
    setError("");
    if (action === "approve") {
      if (!user || !isTrustedWorkRedirect(details.redirect_uri)) {
        setError("No se pudo verificar esta conexión de ChatGPT Work.");
        setSubmitting(null);
        return;
      }
      const { error: trustError } = await supabase.from("work_oauth_clients").upsert({
        user_id: user.id,
        client_id: details.client.id,
        client_name: details.client.name || "ChatGPT Work",
        client_uri: details.client.uri || null,
        redirect_uri: details.redirect_uri,
        active: true,
        last_authorized_at: new Date().toISOString(),
      }, { onConflict: "user_id,client_id" });
      if (trustError) {
        setError("GENEAI no pudo registrar esta conexión segura. Inténtalo nuevamente.");
        setSubmitting(null);
        return;
      }
    }
    const result = action === "approve"
      ? await supabase.auth.oauth.approveAuthorization(details.authorization_id, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(details.authorization_id, { skipBrowserRedirect: true });

    if (result.error || !result.data?.redirect_url) {
      setError(result.error?.message || "No pudimos completar tu decisión.");
      setSubmitting(null);
      return;
    }
    window.location.assign(result.data.redirect_url);
  };

  const requestedScopes = details?.scope.split(/\s+/).filter(Boolean) ?? [];
  const clientName = details?.client.name?.trim() || "ChatGPT Work";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-7 flex justify-center">
          <BrandLogo size={72} showText textPosition="bottom" subtitle="Archivo familiar privado" />
        </div>
        <Card className="archivo-card overflow-hidden">
          <CardHeader className="border-b border-border/60 bg-muted/25 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <CardTitle className="font-serif text-2xl">Conectar con {clientName}</CardTitle>
            <CardDescription>
              GENEAI te pide permiso antes de compartir o modificar información de tu árbol.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 pt-6">
            {loading || authLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Verificando la conexión…
              </div>
            ) : error ? (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            ) : details ? (
              <>
                <div className="rounded-lg border border-border/70 bg-background p-4">
                  <p className="mb-3 text-sm font-medium">Al permitirlo, Work podrá:</p>
                  <ul className="space-y-2.5 text-sm text-muted-foreground">
                    <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Buscar y consultar personas de tu árbol activo.</li>
                    <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Crear o corregir personas cuando tú lo pidas.</li>
                    <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Añadir relaciones familiares y propuestas de cambio.</li>
                  </ul>
                </div>

                {requestedScopes.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Permisos de cuenta</p>
                    <div className="flex flex-wrap gap-2">
                      {requestedScopes.map((scope) => (
                        <span key={scope} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                          {scopeLabels[scope] || scope}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 rounded-lg bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>Work usará tu misma cuenta y los mismos datos de GENEAI. No podrá borrar personas y cada cambio quedará sujeto a los permisos de tu árbol.</span>
                </div>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  Cuenta: {details.user.email}
                  <ExternalLink className="h-3 w-3" />
                </p>
                {details.client.uri && (
                  <p className="break-all text-[11px] text-muted-foreground">
                    Servicio solicitante: {details.client.uri}
                  </p>
                )}
              </>
            ) : null}
          </CardContent>

          {!loading && !authLoading && details && (
            <CardFooter className="grid grid-cols-1 gap-3 border-t border-border/60 bg-muted/20 pt-6 sm:grid-cols-2">
              <Button variant="outline" onClick={() => decide("deny")} disabled={submitting !== null} className="gap-2">
                {submitting === "deny" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                Cancelar
              </Button>
              <Button onClick={() => decide("approve")} disabled={submitting !== null} className="gap-2">
                {submitting === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Permitir acceso
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
