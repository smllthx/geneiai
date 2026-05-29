import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type ExpandBranchButtonProps = {
  expanded?: boolean;
  onClick: () => void;
};

export default function ExpandBranchButton({ expanded, onClick }: ExpandBranchButtonProps) {
  return (
    <Button size="sm" variant="outline" className="h-7 px-2" title={expanded ? "Colapsar rama" : "Expandir rama"} onClick={(event) => { event.stopPropagation(); onClick(); }}>
      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
    </Button>
  );
}

