import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, RefreshCw, Upload, Link as LinkIcon, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import MenusConfig from "@/components/MenusConfig";


const SEED_VARIANTES: [string, string][] = [
  ["Sanguineti","Sanguinetti"],["Sanguineti","Sanguinetto"],
  ["Aeschlimann","Aeschliman"],["Aeschlimann","Eschlimann"],
  ["Queirolo","Queyrolo"],["Queirolo","Quirolo"],["Queirolo","Cairolo"],
];

export default function Configuracion() {
  const [variantes, setVariantes] = useState<any[]>([]);
  const [d, setD] = useState({ apellido_base: "", variante: "" });
  const [fsAccount, setFsAccount] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [aiCfg, setAiCfg] = useState<{ openai_api_key: string; ai_preferred_provider: string; hasKey: boolean }>({ openai_api_key: "", ai_preferred_provider: "auto", hasKey: false });

  const load = async () => {
    const user = (await supabase.auth.getUser()).data.user;
    const [{ data: v }, { data: a }, { data: cfg }] = await Promise.all([
      supabase.from("variantes_apellido").select("*").order("apellido_base"),
      supabase.from("external_accounts").select("*").eq("provider", "familysearch").maybeSingle(),
      user ? supabase.from("app_config").select("openai_api_key,ai_preferred_provider").maybeSingle() : Promise.resolve({ data: null } as any),
    ]);
    setVariantes(v ?? []);
    setFsAccount(a);
    if (cfg) {
      const k = (cfg as any).openai_api_key as string | null;
      setAiCfg({
        openai_api_key: k ? `••••••••${k.slice(-4)}` : "",
        ai_preferred_provider: (cfg as any).ai_preferred_provider ?? "auto",
        hasKey: !!k,
      });
    }
  };
  useEffect(() => { load(); }, []);

  const saveOpenAIKey = async (rawKey: string, provider: string) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return toast.error("Sesión requerida");
    const value: any = { user_id: user.id, ai_preferred_provider: provider };
    // No sobrescribir si el campo muestra los puntos enmascarados
    if (rawKey && !rawKey.includes("•")) value.openai_api_key = rawKey.trim();
    const { error } = await supabase.from("app_config").upsert(value, { onConflict: "user_id" });
    if (error) return toast.error(error.message);
    toast.success("Configuración de IA guardada. Tus llamadas de IA usarán tu cuenta de OpenAI.");
    load();
  };

  const clearOpenAIKey = async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    const { error } = await supabase.from("app_config").upsert({ user_id: user.id, openai_api_key: null, ai_preferred_provider: "auto" } as any, { onConflict: "user_id" });
    if (error) return toast.error(error.message);
    toast.success("API key de OpenAI eliminada.");
    load();
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
      <PageHeader title="Configuración" subtitle="IA, conexiones, variantes de apellido y datos de ejemplo." />

      <Card className="archivo-card mb-6">
        <CardHeader><CardTitle className="font-serif text-xl">IA — Tu cuenta de OpenAI</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Pegá tu <strong>API key</strong> de OpenAI (creala en <a className="underline text-link" href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">platform.openai.com/api-keys</a>). Mientras esté presente, todas las funciones de IA de la app usan <strong>tu cuenta</strong> en vez de los créditos de Lovable. Tu suscripción de ChatGPT Plus/Pro no incluye API — la API se paga aparte por uso (centavos por consulta).
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="password"
              placeholder={aiCfg.hasKey ? aiCfg.openai_api_key : "sk-..."}
              value={aiCfg.openai_api_key}
              onChange={(e) => setAiCfg({ ...aiCfg, openai_api_key: e.target.value })}
            />
            <select
              className="rounded-md border border-border bg-background px-3 text-sm"
              value={aiCfg.ai_preferred_provider}
              onChange={(e) => setAiCfg({ ...aiCfg, ai_preferred_provider: e.target.value })}
            >
              <option value="auto">Auto (usa tu key si existe)</option>
              <option value="openai">Solo OpenAI (mi cuenta)</option>
              <option value="lovable">Solo Lovable (créditos)</option>
            </select>
            <Button onClick={() => saveOpenAIKey(aiCfg.openai_api_key, aiCfg.ai_preferred_provider)}>Guardar</Button>
            {aiCfg.hasKey && <Button variant="outline" onClick={clearOpenAIKey}>Borrar key</Button>}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {aiCfg.hasKey ? "✅ Tu API key está guardada y se usa en las funciones de IA migradas (curiosidades, biografía, asistente, búsqueda IA, contexto histórico, foto y agentes paralelos)." : "Sin API key guardada — la IA usa créditos de Lovable o modo local."}
          </p>
        </CardContent>
      </Card>

      <MenusConfig />




      <Card className="archivo-card mb-6">
        <CardHeader><CardTitle className="font-serif text-xl">FamilySearch</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border p-3 space-y-2">
            <Label className="font-medium">Credenciales de desarrollador</Label>
            <p className="text-xs text-muted-foreground">
              Registra tu app en <a href="https://www.familysearch.org/developers/" target="_blank" rel="noopener noreferrer" className="underline text-link">familysearch.org/developers</a> (tipo Browser/Public — no requiere Client Secret). Redirect URI a usar: <code className="text-xs">{window.location.origin}/familysearch/callback</code>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Para guardar tu <strong>Client ID</strong> (y opcionalmente el <strong>Secret</strong>) pídeselo al asistente de Lovable diciendo «actualiza mis credenciales de FamilySearch». Se almacenan cifradas en el servidor y nunca quedan expuestas al navegador.
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
