import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const preference = "geneai:tree-generations";

export function useTreeGenerations() {
  const [depth, setDepth] = useState(() => {
    try {
      const saved = localStorage.getItem(preference);
      if (saved === "all") return Infinity;
      const value = Number(saved);
      return Number.isSafeInteger(value) && value >= 1 ? value : 4;
    } catch { return 4; }
  });
  function change(value: number) {
    setDepth(value);
    try { localStorage.setItem(preference, value === Infinity ? "all" : String(value)); } catch { /* Storage is optional. */ }
  }
  return [depth, change] as const;
}

export default function GenerationControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const id = useId();
  const [input, setInput] = useState(value === Infinity ? "" : String(value));
  const number = Number(input);
  const valid = Number.isSafeInteger(number) && number >= 1;
  return <fieldset className="w-full min-w-0 space-y-2">
    <legend className="text-sm font-medium">Generaciones visibles</legend>
    <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); if (valid) onChange(number); }}>
      <label htmlFor={id} className="sr-only">Número de generaciones</label>
      <Input id={id} type="number" min={1} step={1} inputMode="numeric" placeholder="Cantidad" value={input} onChange={e => setInput(e.target.value)} className="min-w-0 flex-1" />
      <Button type="submit" size="sm" variant="outline" disabled={!valid || value === number}>Aplicar</Button>
      <Button type="button" size="sm" variant={value === Infinity ? "default" : "outline"} aria-pressed={value === Infinity}
        onClick={() => { setInput(""); onChange(Infinity); }}>Todas</Button>
    </form>
    <p aria-live="polite" className="text-xs text-muted-foreground">{value === Infinity ? "Todas las generaciones registradas" : `Hasta ${value} ${value === 1 ? "generación" : "generaciones"} desde la persona central`}</p>
  </fieldset>;
}
