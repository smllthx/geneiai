// Centro de configuración: vista por defecto del árbol, auto-configuración
// inteligente según el tamaño del árbol, y "Aplicar y reiniciar" que limpia
// cachés y recarga la app para que los cambios se vean en todos los menús.
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, RotateCcw, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { setPreset, setMobileItems, DEFAULT_MOBILE, type NavPreset } from "@/lib/navConfig";

const TREE_KEY = "genaia:default-tree-view";
export type DefaultTreeView = "ascendientes" | "abanico" | "dinastica";

export function getDefaultTreeView(): DefaultTreeView {
  try { return (localStorage.getItem(TREE_KEY) as DefaultTreeView) || "ascendientes"; } catch { return "ascendientes"; }
}
export function setDefaultTreeView(v: DefaultTreeView) {
  try {
    localStorage.setItem(TREE_KEY, v);
    window.dispatchEvent(new CustomEvent("genaia:default-tree-view", { detail: v }));
  } catch {}
}

const VIEW_OPTIONS: { key: DefaultTreeView; label: string; desc: string }[] = [
  { key: "ascendientes", label: "Clásico (FamilySearch)", desc: "Pedigree vertical descendente, ideal para navegar generaciones." },
  { key: "abanico", label: "Abanico", desc: "Vista radial compacta para ver muchas generaciones de un vistazo." },
  { key: "dinastica", label: "Dinástica", desc: "Vista horizontal por ramas, útil para descendencias amplias." },
];

export default function AppCenterConfig() {
  const [view, setView] = useState<DefaultTreeView>(() => getDefaultTreeView());
  const [analyzing, setAnalyzing] = useState(false);
  const [personas, setPersonas] = useState<any[]>([]);
  const [probandId, setProbandId] = useState("");

  useEffect(() => {
    const r = () => setView(getDefaultTreeView());
    window.addEventListener("genaia:default-tree-view", r);
    return () => window.removeEventListener("genaia:default-tree-view", r);
  }, []);

  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;
      const [{ data: p }, { data: prof }] = await Promise.all([
        supabase.from("personas").select("id,nombres,apellidos,nac_fecha").order("apellidos"),
        supabase.from("profiles").select("proband_id").eq("id", user.id).maybeSingle(),
      ]);
      setPersonas((p as any) ?? []);
      setProbandId((prof as any)?.proband_id ?? "");
    })();
  }, []);

  const applyView = (v: DefaultTreeView) => { setDefaultTreeView(v); setView(v); toast.success("Vista por defecto del árbol actualizada"); };

  const saveProband = async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) { toast.error("Sesión requerida"); return; }
    if (!probandId) { toast.error("Elige una persona principal"); return; }
    const { error } = await supabase
      .from("profiles")
      .update({ proband_id: probandId, proband_asked: true })
      .eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Persona central del árbol guardada");
  };

  const autoConfigure = async () => {
    setAnalyzing(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) { toast.error("Sesión requerida"); return; }
      const [{ count: nPers }, { count: nRels }, { count: nDocs }] = await Promise.all([
        supabase.from("personas").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("relaciones").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("documentos").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      const p = nPers ?? 0, r = nRels ?? 0, d = nDocs ?? 0;

      let preset: NavPreset = "avanzado";
      let viewRec: DefaultTreeView = "ascendientes";
      if (p < 15) { preset = "basico"; viewRec = "ascendientes"; }
      else if (p < 80) { preset = "avanzado"; viewRec = "ascendientes"; }
      else { preset = "pro"; viewRec = "abanico"; }

      const mobile = [...DEFAULT_MOBILE];
      if (d > 10 && !mobile.includes("/documentos")) {
        mobile.splice(4, 0, "/documentos"); mobile.length = 5;
      }

      setPreset(preset);
      setMobileItems(mobile);
      setDefaultTreeView(viewRec);
      setView(viewRec);

      toast.success(`Auto-configurado: ${p} personas · ${r} relaciones · ${d} docs → preset ${preset}, vista ${viewRec}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al auto-configurar");
    } finally { setAnalyzing(false); }
  };

  const applyAndReload = async () => {
    const t = toast.loading("Aplicando cambios…");
    try {
      // Limpia cachés del service worker
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update().catch(() => null)));
      }
      toast.dismiss(t);
      toast.success("Reiniciando…");
      setTimeout(() => window.location.reload(), 400);
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message ?? "No se pudo reiniciar");
    }
  };

  return (
    <Card className="archivo-card mb-6">
      <CardHeader>
        <CardTitle className="font-serif text-xl flex items-center gap-2">
          <Sparkles className="h-5 w-5" /> Centro de la app
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Persona central del árbol</Label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Select value={probandId} onValueChange={setProbandId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={personas.length ? "Elige la persona central" : "Primero crea o importa personas"} />
              </SelectTrigger>
              <SelectContent>
                {personas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombres} {p.apellidos}{p.nac_fecha ? ` · ${new Date(p.nac_fecha).getUTCFullYear()}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={saveProband} disabled={!personas.length || !probandId} className="rounded-xl">
              Guardar persona central
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            El árbol se abrirá centrado en esta persona y mostrará sus ascendientes paternos y maternos.
          </p>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Vista por defecto del árbol</Label>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {VIEW_OPTIONS.map((o) => (
              <button
                key={o.key}
                onClick={() => applyView(o.key)}
                className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                  view === o.key ? "border-primary bg-primary/5" : "border-border hover:bg-foreground/5"
                }`}
              >
                <div className="font-medium">{o.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{o.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={autoConfigure} disabled={analyzing} className="rounded-xl">
            <Wand2 className="h-4 w-4" />
            {analyzing ? "Analizando…" : "Auto-configurar según mi árbol"}
          </Button>
          <Button variant="outline" onClick={applyAndReload} className="rounded-xl">
            <RotateCcw className="h-4 w-4" /> Aplicar y reiniciar
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          "Auto-configurar" elige el preset de menús y la vista de árbol según el tamaño de tu árbol. "Aplicar y reiniciar" limpia cachés y recarga la app para que los cambios se vean en todos los menús.
        </p>
      </CardContent>
    </Card>
  );
}
