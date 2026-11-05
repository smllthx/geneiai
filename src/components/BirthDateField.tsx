import { useState } from "react";
import { Input } from "./ui/input";
import type { BirthFields } from "@/lib/personDates";

const empty = { nac_fecha: null, nac_fecha_aprox: "", nac_rango_ini: null, nac_rango_fin: null };
type Precision = "exact" | "approx" | "range";

export default function BirthDateField({ person, onChange }: {
  person: BirthFields; onChange: (value: Required<BirthFields>) => void;
}) {
  const [mode, setMode] = useState<Precision>(() => person.nac_fecha ? "exact" : person.nac_fecha_aprox ? "approx"
    : person.nac_rango_ini != null || person.nac_rango_fin != null ? "range" : "exact");

  return <fieldset className="min-w-0 space-y-2">
    <legend className="mb-1 text-sm font-medium">Fecha de nacimiento</legend>
    <select aria-label="Precisión de la fecha de nacimiento" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      value={mode} onChange={event => setMode(event.target.value as Precision)}>
      <option value="exact">Fecha exacta</option>
      <option value="approx">Fecha aproximada</option>
      <option value="range">Intervalo de años</option>
    </select>
    {mode === "exact" && <Input type="date" aria-label="Fecha exacta de nacimiento" value={person.nac_fecha ?? ""}
      onChange={e => onChange({ ...empty, nac_fecha: e.target.value || null })} />}
    {mode === "approx" && <Input aria-label="Fecha aproximada de nacimiento" placeholder="Por ejemplo, hacia 1880"
      value={person.nac_fecha_aprox ?? ""} onChange={e => onChange({ ...empty, nac_fecha_aprox: e.target.value })} />}
    {mode === "range" && <div className="flex gap-2">
      <Input type="number" aria-label="Año inicial" placeholder="Desde" min={1} max={9999} value={person.nac_rango_ini ?? ""}
        onChange={e => onChange({ ...empty, nac_rango_ini: e.target.value ? Number(e.target.value) : null, nac_rango_fin: person.nac_rango_fin ?? null })} />
      <Input type="number" aria-label="Año final" placeholder="Hasta" min={person.nac_rango_ini ?? 1} max={9999} value={person.nac_rango_fin ?? ""}
        onChange={e => onChange({ ...empty, nac_rango_ini: person.nac_rango_ini ?? null, nac_rango_fin: e.target.value ? Number(e.target.value) : null })} />
    </div>}
  </fieldset>;
}
