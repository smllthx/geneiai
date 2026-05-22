import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MapPin, Plus, X, Loader2, Globe2 } from "lucide-react";
import { toast } from "sonner";

type NomSuggestion = {
  display_name: string;
  address?: {
    country?: string; state?: string; region?: string; county?: string;
    province?: string; city?: string; town?: string; village?: string;
    municipality?: string; hamlet?: string; suburb?: string;
  };
};

async function searchNominatim(q: string, signal: AbortSignal): Promise<NomSuggestion[]> {
  if (q.trim().length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&accept-language=es&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal, headers: { "Accept": "application/json" } });
  if (!res.ok) return [];
  return res.json();
}

function suggestionToDraft(s: NomSuggestion) {
  const a = s.address ?? {};
  return {
    pais: a.country ?? "",
    region: a.state ?? a.region ?? "",
    provincia: a.province ?? a.county ?? "",
    ciudad: a.city ?? a.town ?? a.village ?? a.municipality ?? a.hamlet ?? a.suburb ?? "",
    parroquia: "",
  };
}

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
  const [remote, setRemote] = useState<NomSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const selected = lugares.find((l) => l.id === value) ?? null;
  const filtered = lugares
    .filter((l) => !q || lugarLabel(l).toLowerCase().includes(q.toLowerCase()))
    .slice(0, 30);

  // Debounced remote search (OpenStreetMap Nominatim — no API key)
  useEffect(() => {
    if (!open) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    if (q.trim().length < 3) { setRemote([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const list = await searchNominatim(q, ctrl.signal);
        setRemote(list);
      } catch { /* aborted */ }
      finally { setSearching(false); }
    }, 350);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, open]);

  const crearDesde = async (d: typeof draft, label?: string) => {
    if (!d.pais && !d.ciudad && !d.region) {
      toast.error("Indica al menos país o ciudad");
      return;
    }
    setCreating(true);
    const user = (await supabase.auth.getUser()).data.user!;
    const { data, error } = await supabase.from("lugares").insert({ ...d, user_id: user.id }).select().single();
    setCreating(false);
    if (error) return toast.error(error.message);
    onLugaresChange?.([...lugares, data]);
    onChange(data.id);
    setDraft({ pais: "", region: "", provincia: "", ciudad: "", parroquia: "" });
    setQ("");
    setOpen(false);
    toast.success(label ? `Lugar añadido: ${label}` : "Lugar creado");
  };

  const crear = () => crearDesde(draft);

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
      <PopoverContent className="w-[340px] p-2" align="start">
        <div className="relative mb-2">
          <Input
            placeholder="Buscar lugar… (ej. Valparaíso, Chile)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          {searching && <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin opacity-60" />}
        </div>

        <div className="max-h-72 overflow-y-auto">
          {filtered.length > 0 && (
            <>
              <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tus lugares</p>
              {filtered.map((l) => (
                <button key={l.id} type="button"
                  onClick={() => { onChange(l.id); setOpen(false); }}
                  className="block w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-foreground/5">
                  <MapPin className="mr-1.5 inline h-3 w-3 opacity-50" />{lugarLabel(l)}
                </button>
              ))}
            </>
          )}

          {remote.length > 0 && (
            <>
              <p className="mt-2 px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sugerencias del mapa</p>
              {remote.map((s, i) => {
                const d = suggestionToDraft(s);
                const label = [d.ciudad, d.provincia, d.region, d.pais].filter(Boolean).join(", ") || s.display_name;
                return (
                  <button key={i} type="button"
                    onClick={() => crearDesde(d, label)}
                    disabled={creating}
                    className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-primary/10 disabled:opacity-50">
                    <Globe2 className="mr-1.5 inline h-3 w-3 text-primary" />
                    <span className="font-medium">{label}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{s.display_name}</span>
                  </button>
                );
              })}
            </>
          )}

          {!searching && q.trim().length >= 3 && remote.length === 0 && filtered.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">Sin resultados. Puedes crearlo manualmente abajo.</p>
          )}
        </div>

        <details className="mt-2 border-t pt-2">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Crear manualmente</summary>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Input className="h-8 text-xs" placeholder="Ciudad" value={draft.ciudad} onChange={(e) => setDraft({ ...draft, ciudad: e.target.value })} />
            <Input className="h-8 text-xs" placeholder="Provincia" value={draft.provincia} onChange={(e) => setDraft({ ...draft, provincia: e.target.value })} />
            <Input className="h-8 text-xs" placeholder="Región" value={draft.region} onChange={(e) => setDraft({ ...draft, region: e.target.value })} />
            <Input className="h-8 text-xs" placeholder="País" value={draft.pais} onChange={(e) => setDraft({ ...draft, pais: e.target.value })} />
            <Input className="col-span-2 h-8 text-xs" placeholder="Parroquia / archivo" value={draft.parroquia} onChange={(e) => setDraft({ ...draft, parroquia: e.target.value })} />
          </div>
          <Button size="sm" className="mt-2 h-8 w-full" onClick={crear} disabled={creating} type="button">
            <Plus className="mr-1 h-3.5 w-3.5" /> Crear y seleccionar
          </Button>
        </details>
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
