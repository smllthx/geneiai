import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Mail, Trash2, RefreshCw, Upload, Link as LinkIcon, ShieldCheck, Sparkles, UserRound, GitBranch, Plus, MessagesSquare, Unplug } from "lucide-react";
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
  ["González","Gonzales"],["Fernández","Fernandes"],
  ["Muñoz","Munoz"],["Martínez","Martines"],
  ["López","Lopez"],["Díaz","Dias"],["Pérez","Peres"],
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

function WorkConnectionCard() {
  type WorkGrant = {
    client: { id: string; name: string; uri: string };
    scopes: string[];
    granted_at: string;
  };

  const [grants, setGrants] = useState<WorkGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState("");

  const loadGrants = async () => {
    setLoading(true);
    const [{ data, error }, { data: approved, error: approvedError }] = await Promise.all([
      supabase.auth.oauth.listGrants(),
      supabase.from("work_oauth_clients").select("client_id").eq("active", true),
    ]);
    if (!error && !approvedError) {
      const approvedIds = new Set((approved ?? []).map((client) => client.client_id));
      setGrants((data ?? []).filter((grant) => approvedIds.has(grant.client.id)));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadGrants();
  }, []);

  const revoke = async (clientId: string) => {
    if (!window.confirm("¿Desconectar ChatGPT Work de tu cuenta GENEAI?")) return;
    setRevoking(clientId);
    const { error: trustError } = await supabase.from("work_oauth_clients")
      .update({ active: false })
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
      .eq("client_id", clientId);
    if (trustError) {
      setRevoking("");
      return toast.error("No se pudo bloquear la conexión en GENEAI. Inténtalo de nuevo.");
    }
    const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
    setRevoking("");
    if (error) return toast.error("GENEAI bloqueó el acceso, pero falta retirar el permiso OAuth. Vuelve a intentarlo.");
    toast.success("ChatGPT Work fue desconectado de GENEAI.");
    loadGrants();
  };

  return (
    <Card className="archivo-card mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-xl">
          <MessagesSquare className="h-5 w-5" /> ChatGPT Work
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Usa GENEAI y Work al mismo tiempo. Work consulta y modifica el mismo árbol activo con tu autorización; no crea una copia de tus datos.
        </p>
        <div className="rounded-xl border border-border/70 bg-card/45 p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Comprobando conexiones…</p>
          ) : grants.length ? (
            <div className="space-y-3">
              {grants.map((grant) => (
                <div key={grant.client.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      {grant.client.name || "ChatGPT Work"} conectado
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Acceso concedido {grant.granted_at ? new Date(grant.granted_at).toLocaleDateString("es-CL") : ""}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => revoke(grant.client.id)} disabled={revoking === grant.client.id}>
                    <Unplug className="h-4 w-4" /> {revoking === grant.client.id ? "Desconectando…" : "Desconectar"}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
              <div>
                <p className="font-medium">Listo para conectar</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Al activar GENEAI en Work aparecerá una pantalla de permiso. Ninguna persona se puede borrar desde esta conexión.
                </p>
              </div>
            </div>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          La conexión con Work no usa ni muestra la API key privada configurada para las funciones IA internas de GENEAI.
        </p>
      </CardContent>
    </Card>
  );
}

function TreesAdminCard() {
  const [trees, setTrees] = useState<any[]>([]);
  const [activeTree, setActiveTree] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);

  const loadTrees = async () => {
    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;
      const [{ data: arboles }, { data: profile }] = await Promise.all([
        (supabase as any).from("arboles").select("*").order("created_at", { ascending: true }),
        supabase.from("profiles").select("active_arbol_id").eq("id", user.id).maybeSingle(),
      ]);
      setTrees(arboles ?? []);
      setActiveTree((profile as any)?.active_arbol_id ?? arboles?.[0]?.id ?? "");
    } catch {
      setTrees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTrees(); }, []);

  const createTree = async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return toast.error("Sesión requerida");
    const name = newName.trim();
    if (!name) return toast.error("Escribe un nombre para el árbol");
    const { data, error } = await (supabase as any)
      .from("arboles")
      .insert({ user_id: user.id, nombre: name })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    await supabase.from("profiles").update({ active_arbol_id: data.id } as any).eq("id", user.id);
    setNewName("");
    toast.success("Árbol creado y seleccionado");
    window.dispatchEvent(new CustomEvent("genaia:data-changed", { detail: { table: "arboles" } }));
    loadTrees();
  };

  const selectTree = async (id: string) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ active_arbol_id: id } as any).eq("id", user.id);
    if (error) return toast.error(error.message);
    setActiveTree(id);
    toast.success("Árbol activo cambiado");
    window.dispatchEvent(new CustomEvent("genaia:data-changed", { detail: { table: "arboles" } }));
  };

  return (
    <Card className="archivo-card mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-xl">
          <GitBranch className="h-5 w-5" /> Árboles separados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Administra más de un árbol dentro de la misma cuenta. Cada árbol puede quedar separado para no mezclar personas, relaciones, eventos y fuentes.
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando árboles…</p>
        ) : trees.length === 0 ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            La base aún no tiene la tabla de árboles aplicada. Sube la migración de Supabase para activar esta administración.
          </p>
        ) : (
          <div className="grid gap-2">
            {trees.map((tree) => (
              <button
                key={tree.id}
                onClick={() => selectTree(tree.id)}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  activeTree === tree.id ? "border-primary bg-primary/15 text-primary" : "border-border bg-card/45 hover:bg-foreground/5"
                }`}
              >
                <div className="font-medium">{tree.nombre}</div>
                <div className="text-xs text-muted-foreground">{tree.is_default ? "Árbol principal" : "Árbol adicional"}</div>
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre del nuevo árbol" />
          <Button onClick={createTree}><Plus className="h-4 w-4" /> Crear árbol</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Configuracion() {
  const [variantes, setVariantes] = useState<any[]>([]);
  const [d, setD] = useState({ apellido_base: "", variante: "" });
  const [fsAccount, setFsAccount] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [aiCfg, setAiCfg] = useState<{ openai_api_key: string; hasKey: boolean }>({ openai_api_key: "", hasKey: false });
  const [devicePasskeySupported, setDevicePasskeySupported] = useState(false);
  const [devicePasskeyEnabled, setDevicePasskeyEnabled] = useState(false);
  const [usageTick, setUsageTick] = useState(0);
  const [accountProfile, setAccountProfile] = useState({
    nombre_completo: "",
    fecha_nacimiento: "",
    lugar_nacimiento: "",
    numero_identificacion: "",
    correo_recuperacion: "",
    telefono_recuperacion: "",
  });
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
    if (user) {
      const meta = (user.user_metadata ?? {}) as any;
      setAccountProfile({
        nombre_completo: meta.nombre_completo ?? meta.display_name ?? "",
        fecha_nacimiento: meta.fecha_nacimiento ?? "",
        lugar_nacimiento: meta.lugar_nacimiento ?? "",
        numero_identificacion: meta.numero_identificacion ?? "",
        correo_recuperacion: meta.correo_recuperacion ?? user.email ?? "",
        telefono_recuperacion: meta.telefono_recuperacion ?? user.phone ?? "",
      });
    }
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

  const saveAccountProfile = async () => {
    const { error } = await supabase.auth.updateUser({
      data: {
        ...accountProfile,
        display_name: accountProfile.nombre_completo,
      },
    });
    if (error) return toast.error(error.message);
    toast.success("Datos de cuenta guardados");
  };

  const suggestCentralPerson = async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return toast.error("Sesión requerida");
    const { data, error } = await supabase
      .from("personas")
      .select("id,nombres,apellidos,nac_fecha,nac_lugar")
      .eq("user_id", user.id);
    if (error) return toast.error(error.message);
    const full = accountProfile.nombre_completo.toLowerCase();
    const best = (data ?? [])
      .map((p: any) => {
        const personText = `${p.nombres ?? ""} ${p.apellidos ?? ""}`.toLowerCase();
        let score = 0;
        for (const word of full.split(/\s+/).filter(Boolean)) if (personText.includes(word)) score += 2;
        if (accountProfile.fecha_nacimiento && p.nac_fecha === accountProfile.fecha_nacimiento) score += 5;
        if (accountProfile.lugar_nacimiento && `${p.nac_lugar ?? ""}`.toLowerCase().includes(accountProfile.lugar_nacimiento.toLowerCase())) score += 2;
        return { p, score };
      })
      .sort((a, b) => b.score - a.score)[0];
    if (!best || best.score < 2) return toast.error("No encontré una persona suficientemente parecida. Elígela manualmente en Centro de la app.");
    const { error: upError } = await supabase
      .from("profiles")
      .update({ proband_id: best.p.id, proband_asked: true })
      .eq("id", user.id);
    if (upError) return toast.error(upError.message);
    toast.success(`Persona central sugerida: ${best.p.nombres} ${best.p.apellidos}`);
  };

  const requestRemoteAppUpdate = async () => {
    const t = toast.loading("Buscando actualización remota…");
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.update();
      }
      window.dispatchEvent(new CustomEvent("genaia:clear-cache"));
      toast.dismiss(t);
      toast.success("Actualización remota solicitada");
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message ?? "No se pudo solicitar la actualización");
    }
  };

  const enableDevicePasskey = async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return toast.error("Sesión requerida");
      await registerDevicePasskey(user.email || "GENEAI");
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
      { user_id: user.id, nombres: "Persona", apellidos: "Ejemplo Uno", certeza: "hipotesis", notas: "DATO DE EJEMPLO / HIPÓTESIS — sin verificar." },
      { user_id: user.id, nombres: "Persona", apellidos: "Ejemplo Dos", certeza: "hipotesis", notas: "DATO DE EJEMPLO / HIPÓTESIS — sin verificar." },
      { user_id: user.id, nombres: "Persona", apellidos: "Ejemplo Tres", certeza: "hipotesis", notas: "DATO DE EJEMPLO / HIPÓTESIS — sin verificar." },
    ]);
    toast.success("Personas de ejemplo creadas (marcadas como hipótesis).");
  };

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Cuenta, persona central, IA, conexiones, menús y actualizaciones remotas." />

      <Card className="archivo-card mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-xl">
            <UserRound className="h-5 w-5" /> Datos de cuenta y persona central
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>Nombre completo</Label><Input value={accountProfile.nombre_completo} onChange={(e) => setAccountProfile({ ...accountProfile, nombre_completo: e.target.value })} /></div>
            <div><Label>Número de identificación</Label><Input value={accountProfile.numero_identificacion} onChange={(e) => setAccountProfile({ ...accountProfile, numero_identificacion: e.target.value })} placeholder="ID personal, RUT, código interno, etc." /></div>
            <div><Label>Fecha de nacimiento</Label><Input type="date" value={accountProfile.fecha_nacimiento} onChange={(e) => setAccountProfile({ ...accountProfile, fecha_nacimiento: e.target.value })} /></div>
            <div><Label>Lugar de nacimiento</Label><Input value={accountProfile.lugar_nacimiento} onChange={(e) => setAccountProfile({ ...accountProfile, lugar_nacimiento: e.target.value })} /></div>
            <div><Label>Correo de recuperación</Label><Input type="email" value={accountProfile.correo_recuperacion} onChange={(e) => setAccountProfile({ ...accountProfile, correo_recuperacion: e.target.value })} /></div>
            <div><Label>Número de recuperación</Label><Input value={accountProfile.telefono_recuperacion} onChange={(e) => setAccountProfile({ ...accountProfile, telefono_recuperacion: e.target.value })} placeholder="+569..." /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveAccountProfile}><Mail className="h-4 w-4" /> Guardar datos</Button>
            <Button variant="outline" onClick={suggestCentralPerson}><UserRound className="h-4 w-4" /> Sugerir persona central</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Estos datos ayudan a GENEAI a identificar tu persona central del árbol y a mantener vías de recuperación de cuenta.
          </p>
        </CardContent>
      </Card>

      <WorkConnectionCard />

      <Card className="archivo-card mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-xl">
            <RefreshCw className="h-5 w-5" /> Actualización remota de la app
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cuando yo publique cambios desde aquí, este botón fuerza a tu navegador a buscar la versión nueva, limpiar caché y sincronizar la interfaz.
          </p>
          <Button variant="outline" onClick={requestRemoteAppUpdate}>
            <RefreshCw className="h-4 w-4" /> Buscar actualización y sincronizar
          </Button>
        </CardContent>
      </Card>

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
      <TreesAdminCard />
      <MenusConfig />

      <Card className="archivo-card mb-6">
        <CardHeader><CardTitle className="font-serif text-xl">Accesos del dispositivo</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>GENEAI adapta controles para móvil, iPad y escritorio. En Mac quedan activos estos accesos rápidos:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {["⌘/Ctrl + 1 Inicio", "⌘/Ctrl + 2 Árbol", "⌘/Ctrl + 3 Personas", "⌘/Ctrl + 4 Tareas", "⌘/Ctrl + 5 Asistente", "⌘/Ctrl + N Nueva persona"].map((item) => (
              <div key={item} className="rounded-xl border border-border/70 bg-card/45 px-3 py-2 text-xs font-medium text-foreground">{item}</div>
            ))}
          </div>
          <p className="text-xs">El Touch Bar no se puede controlar directamente desde una app web moderna; estos accesos funcionan en MacBook con teclado, Safari, Chrome y como PWA.</p>
        </CardContent>
      </Card>


      <Card className="archivo-card mb-6">
        <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-xl"><ShieldCheck className="h-5 w-5" /> Llave iCloud / Face ID / Touch ID</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Activa una passkey del dispositivo para desbloquear GENEAI. En iPhone usa Face ID; en Mac compatible usa Touch ID; Safari puede guardarla en el llavero/iCloud Keychain.
          </p>
          {!devicePasskeySupported ? (
            <p className="text-sm text-muted-foreground">Este navegador no soporta passkeys para esta app.</p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              {devicePasskeyEnabled ? (
                <Button variant="outline" onClick={disableDevicePasskey}>Desactivar en este dispositivo</Button>
              ) : (
                <Button onClick={enableDevicePasskey}>Activar llave iCloud / Face ID / Touch ID</Button>
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
          <p className="mb-3 text-sm text-muted-foreground">Crea tres personas de ejemplo marcadas como hipótesis. No son hechos comprobados.</p>
          <Button variant="outline" onClick={seedDatosEjemplo}>Crear datos de ejemplo</Button>
        </CardContent>
      </Card>
    </div>
  );
}
