import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GenealogyPerson } from "./types";
import AddRelativeButton, { type RelativeKind } from "./AddRelativeButton";
import AIEvidenceButton from "./AIEvidenceButton";
import ExpandBranchButton from "./ExpandBranchButton";

type PersonNodeProps = {
  person: GenealogyPerson;
  selected?: boolean;
  dimmed?: boolean;
  showPortrait?: boolean;
  expanded?: boolean;
  onSelect?: (person: GenealogyPerson) => void;
  onAction?: (action: "profile" | "ai" | "expand", person: GenealogyPerson) => void;
  onAddRelative?: (kind: RelativeKind, person: GenealogyPerson) => void;
};

const statusLabel: Record<GenealogyPerson["researchStatus"], string> = {
  pendiente: "Pendiente",
  en_revision: "En revisión",
  documentado: "Documentado",
};

const lineageClass: Record<GenealogyPerson["lineage"], string> = {
  paterna: "border-emerald-300",
  materna: "border-violet-300",
  central: "border-slate-300",
};

const lineageBar: Record<GenealogyPerson["lineage"], string> = {
  paterna: "bg-emerald-500",
  materna: "bg-violet-500",
  central: "bg-slate-400",
};

export default function PersonNode({ person, selected, dimmed, showPortrait = true, expanded, onSelect, onAction, onAddRelative }: PersonNodeProps) {
  const years = [person.birth, person.death ?? (person.birth ? "Vive" : undefined)].filter(Boolean).join("-");
  const fullName = `${person.givenNames} ${person.surnames}`.trim();

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(person)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect?.(person);
      }}
      className={`relative w-[260px] overflow-hidden rounded-2xl border bg-white p-3 text-left shadow-sm transition ${
        lineageClass[person.lineage]
      } ${selected ? "ring-2 ring-emerald-500" : "hover:-translate-y-0.5 hover:shadow-md"} ${
        dimmed ? "opacity-35" : "opacity-100"
      }`}
      title={fullName}
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${person.incomplete ? "bg-slate-300" : lineageBar[person.lineage]}`} />
      <div className="flex gap-3">
        {showPortrait && <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
          {person.avatarUrl ? (
            <img src={person.avatarUrl} alt={fullName} className="h-full w-full object-cover" />
          ) : person.initials ? (
            person.initials
          ) : (
            <UserRound className="h-5 w-5" />
          )}
        </div>}
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-slate-950">{person.givenNames}</h3>
          <p className="truncate text-xs font-medium text-slate-700">{person.surnames}</p>
          <p className="mt-1 text-[11px] text-slate-500">{years || "Fechas por completar"}</p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-[11px] text-slate-600">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">{person.mainPlace || "Lugar por completar"}</span>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5">{person.sourcesCount} fuentes</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">{statusLabel[person.researchStatus]}</span>
          {person.incomplete && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Incompleto</span>}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_auto_auto] gap-1">
        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={(event) => { event.stopPropagation(); onAction?.("profile", person); }}>
          Ver perfil
        </Button>
        <AddRelativeButton onSelect={(kind) => onAddRelative?.(kind, person)} />
        <AIEvidenceButton compact onClick={() => onAction?.("ai", person)} />
        <ExpandBranchButton expanded={expanded} onClick={() => onAction?.("expand", person)} />
      </div>
    </article>
  );
}
