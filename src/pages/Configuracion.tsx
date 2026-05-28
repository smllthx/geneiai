import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, RefreshCw, Upload, Link as LinkIcon, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import MenusConfig from "@/components/MenusConfig";
import AppCenterConfig from "@/components/AppCenterConfig";
import {
  clearDevicePasskey,
  hasDevicePasskey,
  isDevicePasskeySupported,
  registerDevicePasskey,
} from "@/lib/devicePasskey";
import { summarizeAiUsage, type AiUsagePeriod } from "@/lib/aiUsage";


const SEED_VARIANTES: [string, string][] = [
  ["Sanguineti","Sanguinetti"],["Sanguineti","Sanguinetto"],
  ["Aeschlimann","Aeschliman"],["Aeschlimann","Eschlimann"],
  ["Queirolo","Queyrolo"],["Queirolo","Quirolo"],["Queirolo","Cairolo"],
];

const AI_FEATURES = [
  "Asistente virtual ChatGPT",
  "Búsqueda IA por persona",
  "Insights e hipótesis avanzadas",
  "Biografía automática",
  "Contexto histórico",
  "ADN y origen",
  "Lectura de documentos y PDFs",
  "Análisis de fotos y retratos",
  "Detección de duplicados",
  "Coincidencias en internet",
  "Sugerencias desde documentos",
  "Agentes en paralelo",
  "Diagnóstico de errores",
  "Cuadros genealógicos",
];

const UsageBox = ({ label, usage }: { label: string; usage: AiUsagePeriod }) => (
  <div className="rounded-xl border border-border/70 bg-card/45 p-3">
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-semibold tabular-nums">{usage.credits}</p>
    <p className="text-xs text-muted-foreground">créditos aprox.</p>
    <p className="mt-2 text-[11px] text-muted-foreground">
      {usage.calls} llamadas · {usage.totalTokens.toLocaleString("es-CL")} tokens estimados
      {usage.failed ? ` · ${usage.failed} con error` : ""}
    </p>
  </div>
);

export default function Configuracion() {
  const [variantes, setVariantes] = useState<any[]>([]);
  const [d, setD] = useState({ apellido_base: "", variante: "" });
  const [fsAccount, setFsAccount] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [aiCfg, setAiCfg] = useState<{ openai_api_key: string; hasKey: boolean }>({ openai_api_key: "", hasKey: false });
  const [devicePasskeySupported, setDevicePasskeySupported] = useState(false);
  const [devicePasskeyEnabled, setDevicePasskeyEnabled] = useState(false);
  const [usageTick, setUsageTick] = useState(0);
  const aiUsage = useMemo(() => summarizeAiUsage(), [usageTick]);

  const load = async () => {
    const user = (await supabase.auth.getUser()).data.user;
    const [{ data: v }, { data: a }, { data: cfg }] = await Promise.all([
      supabase.from("variantes_apellido").select("*").order("apellido_base"),
      supabase.from("external_accounts").select("*").eq("provider", "familysearch").maybeSingle(),
      user ? supabase.from("app_config").select("openai_api_key").maybeSingle() : Promise.resolve({ data: null } as any),
    ]);
    setVariantes(v ?? []);
    setFsAccount(a);
    if (cfg) {
      const k = (cfg as any).openai_api_key as string | null;
      setAiCfg({
        openai_api_key: k ? `••••••••${k.slice(-4)}` : "",
        hasKey: !!k,
      });
    }
  };
  useEffect(() => {
    load();
    setDevicePasskeySupported(isDevicePasskeySupported());
    setDevicePasskeyEnabled(hasDevicePasskey());
  }, []);
  useEffect(() => {
    const refresh = () => setUsageTick((n) => n + 1);
    window.addEventListener("genaia:ai-usage-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("genaia:ai-usage-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const saveOpenAIKey = async (rawKey: string) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return toast.error("Sesión requerida");
    if (!rawKey || rawKey.includes("•")) {
      toast.info("La API key guardada se mantiene igual. Reiniciando para aplicar la configuración IA…");
      await supabase.auth.refreshSession();
      window.setTimeout(() => window.location.assign("/inicio?ia=actualizada"), 700);
      return;
    }
    const clean = rawKey.trim();
    if (!clean.startsWith("sk-")) return toast.error("Esa API key no parece de OpenAI. Debe empezar con sk-.");
    const value: any = { user_id: user.id, ai_preferred_provider: "openai" };
    value.openai_api_key = clean;
    const { error } = await supabase.from("app_config").upsert(value, { onConflict: "user_id" });
    if (error) return toast.error(error.message);
    toast.success("ChatGPT quedó guardado. Reiniciando la app para aplicar IA en todas las secciones…");
    try {
      localStorage.setItem("genaia:ai-config-updated", String(Date.now()));
      await supabase.auth.refreshSession();
    } finally {
      window.setTimeout(() => window.location.assign("/inicio?ia=actualizada"), 900);
    }
  };

  const clearOpenAIKey = async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    const { error } = await supabase.from("app_config").upsert({ user_id: user.id, openai_api_key: null, ai_preferred_provider: "openai" } as any, { onConflict: "user_id" });
    if (error) return toast.error(error.message);
    toast.success("API key de OpenAI eliminada.");
    load();
  };

  const enableDevicePasskey = async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return toast.error("Sesión requerida");
      await registerDevicePasskey(user.email || "GENAIA");
      setDevicePasskeyEnabled(true);
      toast.success("Face ID / Touch ID activado en este dispositivo.");
    } catch (error: any) {
      toast.error(error.message || "No se pudo activar Face ID / Touch ID.");
    }
  };

  const disableDevicePasskey = () => {
    clearDevicePasskey();
    setDevicePasskeyEnabled(false);
    toast.success("Face ID / Touch ID desactivado en este dispositivo.");
  };


  const toggleAutoSync = async (on: boolean) => {
    if (!fsAccount) return;
    const newMeta = { ...(fsAccount.metadata ?? {}), auto_sync: on };
    const { error } = await supabase.from("external_accounts")
      .update({ metadata: newMeta }).eq("id", fsAccount.id);
    if (error) return toast.error(error.message);
    setFsAccount({ ...fsAccount, metadata: newMeta });
    toast.success(on ? "Sincronización automática activada (cada 24 h)" : "Sincronización automática desactivada");
  };

  const pushAhora = async () => {
    setBusy(true);
    const t = toast.loading("Subiendo a FamilySearch…");
    try {
      const { data, error } = await supabase.functions.invoke("familysearch-push");
      toast.dismiss(t);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${data.subidas} de ${data.total} personas subidas`);
    } catch (e: any) { toast.dismiss(t); toast.error(e.message); }
    finally { setBusy(false); }
  };

  const sincronizarAhora = async () => {
    setBusy(true);
    const t = toast.loading("Descargando de FamilySearch…");
    try {
      const { data, error } = await supabase.functions.invoke("familysearch-sync",
        { body: { generaciones_asc: 4, generaciones_desc: 2 } });
      toast.dismiss(t);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${data.creadas} personas, ${data.relsCreadas} relaciones`);
    } catch (e: any) { toast.dismiss(t); toast.error(e.message); }
    finally { setBusy(false); }
  };

  const seed = async () => {
    const user = (await supabase.auth.getUser()).data.user!;
    await supabase.from("variantes_apellido").insert(SEED_VARIANTES.map(([apellido_base, variante]) => ({ user_id: user.id, apellido_base, variante })));
    toast.success("Variantes de ejemplo añadidas"); load();
  };
  const add = async () => {
    if (!d.apellido_base || !d.variante) return;
    const user = (await supabase.auth.getUser()).data.user!;
    const { error } = await supabase.from("variantes_apellido").insert({ ...d, user_id: user.id });
    if (error) return toast.error(error.message);
    setD({ apellido_base: "", variante: "" }); load();
  };
  const del = async (id: string) => { await supabase.from("variantes_apellido").delete().eq("id", id); load(); };

  const seedDatosEjemplo = async () => {
    const user = (await supabase.auth.getUser()).data.user!;
    await supabase.from("personas").insert([
      { user_id: user.id, nombres: "Giovanni Battista", apellidos: "Sanguineti", nacionalidad: "Italia (Liguria)", certeza: "hipotesis", notas: "DATO DE EJEMPLO / HIPÓTESIS — origen posible Liguria, sin verificar." },
      { user_id: user.id, nombres: "Maria Rosa", apellidos: "Queirolo", nacionalidad: "Italia (Liguria)", certeza: "hipotesis", notas: "DATO DE EJEMPLO / HIPÓTESIS — origen posible Liguria, sin verificar." },
      { user_id: user.id, nombres: "Johann", apellidos: "Aeschlimann", nacionalidad: "Suiza", certeza: "hipotesis", notas: "DATO DE EJEMPLO / HIPÓTESIS — origen europeo, sin verificar." },
    ]);
    toast.success("Personas de ejemplo creadas (marcadas como hipótesis).");
  };

  return (
    <div>
      <PageHeader title="Configuración" subtitle="IA, conexiones, menús, variantes de apellido y datos de ejemplo." />

      <Card className="archivo-card mb-6">
        <CardHeader><CardTitle className="font-serif text-xl">IA — ChatGPT con tu cuenta de OpenAI</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Pegá tu <strong>API key</strong> de OpenAI (creala en <a className="underline text-link" href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">platform.openai.com/api-keys</a>). Todas las funciones de IA de la app usarán <strong>tu cuenta de OpenAI/ChatGPT</strong>.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="password"
              placeholder={aiCfg.hasKey ? aiCfg.openai_api_key : "sk-..."}
              value={aiCfg.openai_api_key}
              onChange={(e) => setAiCfg({ ...aiCfg, openai_api_key: e.target.value })}
            />
            <Button onClick={() => saveOpenAIKey(aiCfg.openai_api_key)}>Guardar y reiniciar</Button>
            {aiCfg.hasKey && <Button variant="outline" onClick={clearOpenAIKey}>Borrar key</Button>}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {aiCfg.hasKey ? "Tu API key está guardada. Si acabas de cambiarla, usa Guardar y reiniciar para refrescar la sesión." : "Sin API key guardada: las funciones de ChatGPT pedirán configurar OpenAI antes de procesar IA."}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Si no quedan créditos, recarga billing en OpenAI o crea una API key nueva en tu proyecto manual de OpenAI.
          </p>
        </CardContent>
      </Card>

      <Card className="archivo-card mb-6">
        <CardHeader><CardTitle className="font-serif text-xl">Uso estimado de IA</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <UsageBox label="Hoy" usage={aiUsage.day} />
            <UsageBox label="7 días" usage={aiUsage.week} />
            <UsageBox label="30 días" usage={aiUsage.month} />
          </div>
          <p className="text-xs text-muted-foreground">
            Estimación local: 1 crédito equivale aprox. a 1.000 tokens procesados por ChatGPT. OpenAI puede cobrar distinto según modelo y cambios de precio.
          </p>
        </CardContent>
      </Card>

      <Card className="archivo-card mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-xl">
            <Sparkles className="h-5 w-5" /> Opciones IA detectadas ({AI_FEATURES.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {AI_FEATURES.map((item) => (
              <div key={item} className="rounded-xl border border-border/70 bg-card/45 px-3 py-2 text-sm">
                {item}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Todas estas opciones pasan por ChatGPT/OpenAI. Si falta API key o créditos, la app mostrará qué opción IA falló y qué revisar.
          </p>
        </CardContent>
      </Card>

      <AppCenterConfig />
      <MenusConfig />


      <Card className="archivo-card mb-6">
        <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-xl"><ShieldCheck className="h-5 w-5" /> Face ID / Touch ID</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Activa una passkey local para desbloquear GENAIA en este dispositivo. En iPhone usará Face ID; en Mac compatible usará Touch ID.
          </p>
          {!devicePasskeySupported ? (
            <p className="text-sm text-muted-foreground">Este navegador no soporta passkeys para esta app.</p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              {devicePasskeyEnabled ? (
                <Button variant="outline" onClick={disableDevicePasskey}>Desactivar en este dispositivo</Button>
              ) : (
                <Button onClick={enableDevicePasskey}>Activar Face ID / Touch ID</Button>
              )}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            La primera vez en cada dispositivo debes entrar con correo y contraseña. Después puedes desbloquear esta sesión con biometría.
          </p>
        </CardContent>
      </Card>


      <Card className="archivo-card mb-6">
        <CardHeader><CardTitle className="font-serif text-xl">FamilySearch</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border p-3 space-y-2">
            <Label className="font-medium">Credenciales de desarrollador</Label>
            <p className="text-xs text-muted-foreground">
              Registra tu app en <a href="https://www.familysearch.org/developers/" target="_blank" rel="noopener noreferrer" className="underline text-link">familysearch.org/developers</a> (tipo Browser/Public — no requiere Client Secret). Redirect URI a usar: <code className="text-xs">{window.location.origin}/familysearch/callback</code>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Para guardar tu <strong>Client ID</strong> y el <strong>Secret</strong>, usa la sección Credenciales. Se almacenan cifradas en el servidor y nunca quedan expuestas al navegador.
            </p>
          </div>

          {!fsAccount ? (
            <div className="text-sm text-muted-foreground">
              No conectado. Ve a <a href="/importar" className="underline text-link">Importar</a> para conectar tu cuenta de FamilySearch.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                <LinkIcon className="h-4 w-4 text-primary" />
                <span>Conectado{fsAccount.account_ref ? ` como ${fsAccount.account_ref}` : ""}.</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <Label className="font-medium">Sincronización automática diaria</Label>
                  <p className="text-xs text-muted-foreground">Descarga ascendencia y descendencia de FamilySearch cada 24 h.</p>
                </div>
                <Switch checked={!!fsAccount.metadata?.auto_sync} onCheckedChange={toggleAutoSync} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={sincronizarAhora} disabled={busy}>
                  <RefreshCw className="h-4 w-4" /> Sincronizar ahora (pull)
                </Button>
                <Button variant="outline" onClick={pushAhora} disabled={busy}>
                  <Upload className="h-4 w-4" /> Subir personas marcadas (push)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                El push sólo sube personas con la opción "Sincronizar con FamilySearch" activada en su ficha.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="archivo-card mb-6">
        <CardHeader><CardTitle className="font-serif text-xl">Variantes de apellido</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Apellido base" value={d.apellido_base} onChange={(e) => setD({ ...d, apellido_base: e.target.value })} />
            <Input placeholder="Variante" value={d.variante} onChange={(e) => setD({ ...d, variante: e.target.value })} />
            <Button onClick={add}>Añadir</Button>
            <Button variant="outline" onClick={seed}>Cargar ejemplos</Button>
          </div>
          <ul className="divide-y divide-border">{variantes.map((v) => (
            <li key={v.id} className="flex items-center justify-between py-2 text-sm">
              <span><strong>{v.apellido_base}</strong> ↔ {v.variante}</span>
              <Button size="sm" variant="ghost" onClick={() => del(v.id)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}</ul>
        </CardContent>
      </Card>
      <Card className="archivo-card">
        <CardHeader><CardTitle className="font-serif text-xl">Datos de ejemplo</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">Crea tres personas de ejemplo (Sanguineti, Queirolo, Aeschlimann) marcadas como hipótesis. No son hechos comprobados.</p>
          <Button variant="outline" onClick={seedDatosEjemplo}>Crear datos de ejemplo</Button>
        </CardContent>
      </Card>
    </div>
  );
}
