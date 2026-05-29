import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";

type AIEvidenceButtonProps = {
  onClick: () => void;
  compact?: boolean;
};

export default function AIEvidenceButton({ onClick, compact }: AIEvidenceButtonProps) {
  return (
    <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" title="Buscar evidencia con IA" onClick={(event) => { event.stopPropagation(); onClick(); }}>
      <Brain className="h-3.5 w-3.5" />
      {!compact && <span className="ml-1">IA</span>}
    </Button>
  );
}

