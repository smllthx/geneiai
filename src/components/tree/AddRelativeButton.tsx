import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type RelativeKind = "padre" | "madre" | "conyuge" | "hijo" | "hermano";

type AddRelativeButtonProps = {
  onSelect: (kind: RelativeKind) => void;
};

const labels: Record<RelativeKind, string> = {
  padre: "Padre",
  madre: "Madre",
  conyuge: "Cónyuge",
  hijo: "Hijo/a",
  hermano: "Hermano/a",
};

export default function AddRelativeButton({ onSelect }: AddRelativeButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 px-2" title="Agregar familiar" onClick={(event) => event.stopPropagation()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(event) => event.stopPropagation()}>
        {(Object.keys(labels) as RelativeKind[]).map((kind) => (
          <DropdownMenuItem key={kind} onClick={() => onSelect(kind)}>
            {labels[kind]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

