import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2, KeyRound, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/PageHeader";

const PROVEEDORES = [
  { id: "myheritage", nombre: "MyHeritage" },
  { id: "familysearch", nombre: "FamilySearch" },
  { id: "ancestry", nombre: "Ancestry" },
  { id: "geneanet", nombre: "Geneanet" },
];

export default function Credenciales() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<Record<string, { u: string; p: string }>>({});
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.functions.invoke("credenciales-externas", { body: { action: "list" } });
    if (error) { toast.error(error.message); return; }
    setItems(data?.items ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async (proveedor: string) => {
    const v = form[proveedor];
    if (!v?.p) { toast.error("Falta contraseña"); return; }
    setLoading(true);
    const { error } = await supabase.functions.invoke("credenciales-externas", {
      body: { action: "save", proveedor, username: v.u ?? "", password: v.p },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Credenciales guardadas (cifradas)");
    setForm((f) => ({ ...f, [proveedor]: { u: v.u, p: "" } }));
    load();
  };

  const remove = async (proveedor: string) => {
    const { error } = await supabase.functions.invoke("credenciales-externas", { body: { action: "delete", proveedor } });
    if (error) { toast.error(error.message); return; }
    toast.success("Eliminadas");
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Credenciales externas" subtitle="MyHeritage, FamilySearch, Ancestry, Geneanet. Cifradas con AES‑GCM." />

      <GlassCard className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4" /> Tus contraseñas se cifran antes de guardarse. Solo tú puedes leerlas.
        </div>
      </GlassCard>

      {PROVEEDORES.map((pv) => {
        const guardada = items.find((i) => i.proveedor === pv.id);
        return (
          <GlassCard key={pv.id} className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{pv.nombre}</h3>
              {guardada && (
                <Button size="sm" variant="ghost" onClick={() => remove(pv.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            {guardada && <p className="text-xs text-muted-foreground">Guardada · usuario: {guardada.username || "—"}</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label>Usuario / email</Label>
                <Input value={form[pv.id]?.u ?? guardada?.username ?? ""} onChange={(e) => setForm((f) => ({ ...f, [pv.id]: { ...(f[pv.id] ?? { u: "", p: "" }), u: e.target.value } }))} />
              </div>
              <div>
                <Label>Contraseña</Label>
                <Input type="password" value={form[pv.id]?.p ?? ""} onChange={(e) => setForm((f) => ({ ...f, [pv.id]: { ...(f[pv.id] ?? { u: "", p: "" }), p: e.target.value } }))} />
              </div>
            </div>
            <Button size="sm" disabled={loading} onClick={() => save(pv.id)}>Guardar cifrado</Button>
          </GlassCard>
        );
      })}
    </div>
  );
}
