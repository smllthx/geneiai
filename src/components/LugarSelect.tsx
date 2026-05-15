import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MapPin, Plus, X } from "lucide-react";
import { toast } from "sonner";

export interface Lugar {
  id: string;
  pais?: string | null;
  region?: string | null;
  provincia?: string | null;
  ciudad?: string | null;
  parroquia?: string | null;
}

export const lugarLabel = (l: Lugar | null | undefined) => {
  if (!l) return "";
  return [l.ciudad, l.provincia, l.region, l.pais].filter(Boolean).join(", ") + (l.parroquia ? ` · ${l.parroquia}` : "");
};

interface Props {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  lugares: Lugar[];
  onLugaresChange?: (lugares: Lugar[]) => void;
  placeholder?: string;
}

export default function LugarSelect({ value, onChange, lugares, onLugaresChange, placeholder = "Sin lugar" }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ pais: "", region: "", provincia: "", ciudad: "", parroquia: "" });

  const selected = lugares.find((l) => l.id === value) ?? null;
  const filtered = lugares
    .filter((l) => !q || lugarLabel(l).toLowerCase().includes(q.toLowerCase()))
    .slice(0, 30);

  const crear = async () => {
    if (!draft.pais && !draft.ciudad && !draft.region) {
      toast.error("Indica al menos país o ciudad");
      return;
    }
    setCreating(true);
    const user = (await supabase.auth.getUser()).data.user!;
    const { data, error } = await supabase.from("lugares").insert({ ...draft, user_id: user.id }).select().single();
    setCreating(false);
    if (error) return toast.error(error.message);
    onLugaresChange?.([...lugares, data]);
    onChange(data.id);
    setDraft({ pais: "", region: "", provincia: "", ciudad: "", parroquia: "" });
    setOpen(false);
    toast.success("Lugar creado");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal" type="button">
          <span className="flex items-center gap-2 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <span className="truncate">{selected ? lugarLabel(selected) : placeholder}</span>
          </span>
          {selected && (
            <X className="h-3.5 w-3.5 opacity-50 hover:opacity-100" onClick={(e) => { e.stopPropagation(); onChange(null); }} />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-2" align="start">
        <Input placeholder="Buscar lugar…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-2" />
        <div className="max-h-56 overflow-y-auto">
          {filtered.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">No hay coincidencias.</p>}
          {filtered.map((l) => (
            <button key={l.id} type="button"
              onClick={() => { onChange(l.id); setOpen(false); }}
              className="block w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-foreground/5">
              {lugarLabel(l)}
            </button>
          ))}
        </div>
        <div className="mt-2 border-t pt-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nuevo lugar</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Input className="h-8 text-xs" placeholder="Ciudad" value={draft.ciudad} onChange={(e) => setDraft({ ...draft, ciudad: e.target.value })} />
            <Input className="h-8 text-xs" placeholder="Provincia" value={draft.provincia} onChange={(e) => setDraft({ ...draft, provincia: e.target.value })} />
            <Input className="h-8 text-xs" placeholder="Región" value={draft.region} onChange={(e) => setDraft({ ...draft, region: e.target.value })} />
            <Input className="h-8 text-xs" placeholder="País" value={draft.pais} onChange={(e) => setDraft({ ...draft, pais: e.target.value })} />
            <Input className="col-span-2 h-8 text-xs" placeholder="Parroquia / archivo" value={draft.parroquia} onChange={(e) => setDraft({ ...draft, parroquia: e.target.value })} />
          </div>
          <Button size="sm" className="mt-2 h-8 w-full" onClick={crear} disabled={creating} type="button">
            <Plus className="mr-1 h-3.5 w-3.5" /> Crear y seleccionar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function useLugares() {
  const [lugares, setLugares] = useState<Lugar[]>([]);
  useEffect(() => {
    supabase.from("lugares").select("id,pais,region,provincia,ciudad,parroquia").order("pais")
      .then(({ data }) => setLugares(data ?? []));
  }, []);
  return [lugares, setLugares] as const;
}
