import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, RefreshCw, Upload, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

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

  const load = async () => {
    const [{ data: v }, { data: a }] = await Promise.all([
      supabase.from("variantes_apellido").select("*").order("apellido_base"),
      supabase.from("external_accounts").select("*").eq("provider", "familysearch").maybeSingle(),
    ]);
    setVariantes(v ?? []);
    setFsAccount(a);
  };
  useEffect(() => { load(); }, []);

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
      <PageHeader title="Configuración" subtitle="Conexiones, variantes de apellido y datos de ejemplo." />

      <Card className="archivo-card mb-6">
        <CardHeader><CardTitle className="font-serif text-xl">FamilySearch</CardTitle></CardHeader>
        <CardContent className="space-y-4">
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
