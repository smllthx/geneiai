import { Brain, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GenealogyPerson } from "./types";

type PersonSidePanelProps = {
  person: GenealogyPerson | null;
  onClose: () => void;
  onEdit?: (person: GenealogyPerson) => void;
  onAiEvidence?: (person: GenealogyPerson) => void;
};

const statusCopy: Record<GenealogyPerson["researchStatus"], string> = {
  pendiente: "Falta investigación documental",
  en_revision: "Datos en revisión genealógica",
  documentado: "Perfil con evidencia vinculada",
};

export default function PersonSidePanel({ person, onClose, onEdit, onAiEvidence }: PersonSidePanelProps) {
  if (!person) return null;
  const fullName = `${person.givenNames} ${person.surnames}`.trim();

  return (
    <aside className="absolute right-4 top-4 z-20 flex max-h-[calc(100%-2rem)] w-[360px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-700">Ficha genealógica</p>
          <h2 className="mt-1 text-xl font-semibold leading-tight text-slate-950">{fullName}</h2>
          <p className="mt-1 text-xs text-slate-500">{person.id}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Cerrar panel">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4 overflow-y-auto p-4">
        <section className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Información esencial</p>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Nacimiento</dt>
              <dd className="font-medium text-slate-900">{person.birth || "Dato no registrado"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Fallecimiento</dt>
              <dd className="font-medium text-slate-900">{person.death || "Vive o sin dato registrado"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Lugar principal</dt>
              <dd className="font-medium text-slate-900">{person.mainPlace || "Dato no registrado"}</dd>
            </div>
          </dl>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Fuentes</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{person.sourcesCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Estado</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{statusCopy[person.researchStatus]}</p>
          </div>
        </section>

        {person.incomplete && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Faltan datos clave. Prioriza fechas, lugares, fuentes y relaciones directas.
          </div>
        )}
      </div>

      <div className="grid gap-2 border-t border-slate-100 p-4">
        <Button className="justify-start" onClick={() => onEdit?.(person)}>
          <Pencil className="h-4 w-4" /> Editar persona
        </Button>
        <Button variant="outline" className="justify-start" onClick={() => onAiEvidence?.(person)}>
          <Brain className="h-4 w-4" /> Buscar evidencia con IA
        </Button>
      </div>
    </aside>
  );
}

