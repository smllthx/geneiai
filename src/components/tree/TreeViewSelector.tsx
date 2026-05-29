import { GitBranch, ListTree, Network, Orbit, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TreeViewMode } from "./types";

const VIEWS: Array<{ value: TreeViewMode; label: string; icon: any }> = [
  { value: "portrait", label: "Retrato", icon: GitBranch },
  { value: "horizontal", label: "Horizontal", icon: Network },
  { value: "fan", label: "Abanico", icon: Orbit },
  { value: "descendancy", label: "Descendencia", icon: ListTree },
  { value: "founder", label: "Linaje", icon: Route },
];

type TreeViewSelectorProps = {
  value: TreeViewMode;
  onChange: (value: TreeViewMode) => void;
};

export default function TreeViewSelector({ value, onChange }: TreeViewSelectorProps) {
  return (
    <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-sm">
      {VIEWS.map(({ value: itemValue, label, icon: Icon }) => (
        <Button
          key={itemValue}
          type="button"
          size="sm"
          variant={value === itemValue ? "default" : "ghost"}
          className="h-8 gap-1.5 rounded-xl px-2.5 text-xs"
          onClick={() => onChange(itemValue)}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Button>
      ))}
    </div>
  );
}
