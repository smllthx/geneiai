import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LayoutDashboard, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  getPreset, setPreset, getHidden, toggleHidden,
  getMobileItems, setMobileItems, DEFAULT_MOBILE, type NavPreset,
} from "@/lib/navConfig";
import { MOBILE_NAV_OPTIONS } from "@/components/MobileBottomNav";

const SIDEBAR_GROUPS: { key: string; label: string; items: { to: string; label: string }[] }[] = [
  { key: "primary", label: "Principal", items: [
    { to: "/inicio", label: "Inicio" },
    { to: "/sugerencias", label: "Sugerencias" },
    { to: "/arbol", label: "Árbol familiar" },
    { to: "/personas", label: "Personas" },
    { to: "/familias", label: "Familias" },
    { to: "/documentos", label: "Documentos" },
    { to: "/fotos", label: "Fotos" },
    { to: "/calendario", label: "Calendario" },
  ]},
  { key: "investigation", label: "Investigación", items: [
    { to: "/asistente", label: "Asistente IA" },
    { to: "/busqueda-ia", label: "Búsqueda IA" },
    { to: "/insights", label: "Insights IA" },
    { to: "/investigacion", label: "Investigación" },
    { to: "/coincidencias", label: "Coincidencias" },
    { to: "/adn", label: "ADN / Origen" },
    { to: "/parecidos", label: "Rasgos & parecidos" },
    { to: "/fuentes", label: "Fuentes" },
  ]},
  { key: "utility", label: "Herramientas", items: [
    { to: "/importar", label: "Importar / Exportar" },
    { to: "/investigacion?tab=paralelo", label: "Agentes en paralelo" },
    { to: "/credenciales", label: "Credenciales" },
    { to: "/configuracion", label: "Configuración" },
    { to: "/fusionar", label: "Fusionar duplicados" },
  ]},
];

const PRESET_LABELS: Record<NavPreset, string> = {
  basico: "Básico",
  avanzado: "Avanzado",
  pro: "Genealogista Pro",
  personalizado: "Personalizado",
};

export default function MenusConfig() {
  const [preset, setPresetState] = useState<NavPreset>(() => getPreset());
  const [, force] = useState(0);
  const [mobile, setMobile] = useState<string[]>(() => getMobileItems());

  useEffect(() => {
    const refresh = () => { setPresetState(getPreset()); setMobile(getMobileItems()); force((n) => n + 1); };
    window.addEventListener("genaia:nav-config", refresh);
    return () => window.removeEventListener("genaia:nav-config", refresh);
  }, []);

  const applyPreset = (p: NavPreset) => { setPreset(p); setPresetState(p); };

  const toggleMobile = (path: string) => {
    const set = new Set(mobile);
    if (set.has(path)) set.delete(path);
    else if (set.size < 5) set.add(path);
    else { toast.error("Máximo 5 elementos en la barra inferior"); return; }
    const next = [...set];
    setMobile(next); setMobileItems(next);
  };

  return (
    <Card className="archivo-card mb-6">
      <CardHeader>
        <CardTitle className="font-serif text-xl flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5" /> Menús de la app
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Preset</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(PRESET_LABELS) as NavPreset[]).filter(p => p !== "personalizado").map((p) => (
              <Button
                key={p}
                size="sm"
                variant={preset === p ? "default" : "outline"}
                onClick={() => applyPreset(p)}
                className="rounded-xl"
              >
                {PRESET_LABELS[p]}
              </Button>
            ))}
            {preset === "personalizado" && (
              <span className="self-center text-xs text-muted-foreground">· Personalizado</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Los presets ocultan o muestran opciones de golpe. Si tocás un switch, pasa a "Personalizado".
          </p>
        </div>

        {SIDEBAR_GROUPS.map((g) => {
          const hidden = new Set(getHidden(g.key));
          return (
            <div key={g.key}>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">{g.label}</Label>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {g.items.map((it) => (
                  <label key={it.to} className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm">
                    <span>{it.label}</span>
                    <Switch
                      checked={!hidden.has(it.to)}
                      onCheckedChange={() => { toggleHidden(g.key, it.to); force((n) => n + 1); }}
                    />
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Barra inferior móvil (máx 5)</Label>
            <Button size="sm" variant="ghost" onClick={() => { setMobile(DEFAULT_MOBILE); setMobileItems(DEFAULT_MOBILE); }}>
              <RefreshCw className="h-3.5 w-3.5" /> Restablecer
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {Object.entries(MOBILE_NAV_OPTIONS).map(([path, meta]: any) => (
              <label key={path} className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm">
                <span>{meta.label}</span>
                <Switch checked={mobile.includes(path)} onCheckedChange={() => toggleMobile(path)} />
              </label>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
