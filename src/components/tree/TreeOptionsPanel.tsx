import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { TreeOptions } from "./types";

type TreeOptionsPanelProps = {
  open: boolean;
  options: TreeOptions;
  onChange: (options: TreeOptions) => void;
  onClose: () => void;
};

const OPTIONS: Array<{ key: keyof TreeOptions; label: string }> = [
  { key: "showAiHints", label: "Sugerencias IA" },
  { key: "showProblems", label: "Problemas de datos" },
  { key: "showPortraits", label: "Retratos" },
  { key: "showNoSources", label: "Personas sin fuentes" },
  { key: "showAlternativeParents", label: "Padres alternativos" },
  { key: "showAlternativeSpouses", label: "Cónyuges alternativos" },
  { key: "showIncompleteBranches", label: "Ramas incompletas" },
  { key: "darkMode", label: "Modo oscuro del árbol" },
];

export default function TreeOptionsPanel({ open, options, onChange, onClose }: TreeOptionsPanelProps) {
  if (!open) return null;

  const update = (key: keyof TreeOptions, checked: boolean) => onChange({ ...options, [key]: checked });

  return (
    <aside className="absolute left-4 top-24 z-30 w-[320px] max-w-[calc(100%-2rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Opciones</p>
          <h2 className="text-lg font-semibold text-slate-950">Vista del árbol</h2>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        {OPTIONS.map(({ key, label }) => (
          <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-sm">
            <span className="text-slate-700">{label}</span>
            <Switch checked={options[key]} onCheckedChange={(checked) => update(key, checked)} />
          </label>
        ))}
      </div>

      <Button variant="outline" className="mt-4 w-full justify-start">
        <Printer className="h-4 w-4" /> Imprimir o guardar árbol
      </Button>
    </aside>
  );
}
