import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LugarSelect, { useLugares } from "@/components/LugarSelect";
import { cn } from "@/lib/utils";
import { inferLivingStatus, inferNationalityFromPlace, inferSexFromName } from "@/lib/personAutoRules";
import { getActiveTreeId, withTreeScope } from "@/lib/peopleData";

/**
 * "Agregar persona" — layout inspirado en FamilySearch (limpio, columna única,
 * inputs con subrayado, segmentos tipo pill) pero con TODOS los campos de GENEAI.
 */

type Sexo = "masculino" | "femenino" | "otro" | "";
type Viva = "si" | "no" | "desconocido";

const empty = {
  nombres: "",
  apellidos: "",
  sufijo: "",
  variantes_nombre: [] as string[],
  sexo: "" as Sexo,
  viva: "desconocido" as Viva,
  nac_fecha: null as string | null,
  nac_fecha_aprox: "",
  nac_rango_ini: null as number | null,
  nac_rango_fin: null as number | null,
  nac_lugar_id: null as string | null,
  defuncion_fecha: null as string | null,
  defuncion_lugar_id: null as string | null,
  bautismo_fecha: null as string | null,
  bautismo_lugar_id: null as string | null,
  matrimonio_fecha: null as string | null,
  matrimonio_lugar_id: null as string | null,
  entierro_fecha: null as string | null,
  entierro_lugar_id: null as string | null,
  ocupacion: "",
  nacionalidad: "",
  religion: "",
  notas: "",
  certeza: "probable" as "comprobado" | "probable" | "hipotesis" | "descartado",
};

function FieldLine({
  label, children, optional,
}: { label: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="block border-b border-border/60 py-3">
      <span className="block text-[13px] font-medium text-muted-foreground">
        {label} {optional && <span className="opacity-50">(opcional)</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function LineInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full bg-transparent text-[17px] outline-none placeholder:text-muted-foreground/60",
        "py-1 text-foreground",
        props.className,
      )}
    />
  );
}

function Segmented<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex w-full rounded-full bg-muted p-1">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            type="button"
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 rounded-full px-3 py-2 text-sm font-semibold transition-colors",
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function NuevaPersona() {
  const navigate = useNavigate();
  const [p, setP] = useState({ ...empty });
  const [lugares, setLugares] = useLugares();
  const [busy, setBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const set = (k: keyof typeof empty, v: any) => setP((s) => ({ ...s, [k]: v }));
  const setName = (value: string) => setP((s) => {
    const inferredSex = s.sexo ? null : inferSexFromName(value);
    return { ...s, nombres: value, ...(inferredSex ? { sexo: inferredSex } : {}) };
  });
  const setBirthDate = (value: string | null) => setP((s) => {
    const inferredLiving = s.defuncion_fecha ? null : inferLivingStatus(value, s.nac_rango_ini);
    return { ...s, nac_fecha: value, ...(inferredLiving ? { viva: inferredLiving } : {}) };
  });
  const setBirthRangeStart = (value: number | null) => setP((s) => {
    const inferredLiving = s.defuncion_fecha ? null : inferLivingStatus(s.nac_fecha, value);
    return { ...s, nac_rango_ini: value, ...(inferredLiving ? { viva: inferredLiving } : {}) };
  });
  const setBirthPlace = (id: string | null) => setP((s) => {
    const place = lugares.find((l) => l.id === id);
    const inferredNationality = s.nacionalidad ? null : inferNationalityFromPlace(place);
    return { ...s, nac_lugar_id: id, ...(inferredNationality ? { nacionalidad: inferredNationality } : {}) };
  });

  const canContinue = !!(p.nombres.trim() || p.apellidos.trim());

  const save = async (after: "tree" | "detail" = "detail") => {
    if (!canContinue) {
      toast.error("Indica al menos un nombre o apellido");
      return;
    }
    setBusy(true);
    try {
      const user = (await supabase.auth.getUser()).data.user!;
      // sufijo no es columna nativa: lo guardamos como variante de nombre
      const variantes = [
        ...(p.variantes_nombre ?? []),
        ...(p.sufijo.trim() ? [`${p.nombres} ${p.apellidos} ${p.sufijo}`.trim()] : []),
      ];
      const payload: any = {
        user_id: user.id,
        nombres: p.nombres.trim(),
        apellidos: p.apellidos.trim(),
        variantes_nombre: variantes,
        sexo: p.sexo || null,
        viva: p.viva,
        nac_fecha: p.nac_fecha,
        nac_fecha_aprox: p.nac_fecha_aprox || null,
        nac_rango_ini: p.nac_rango_ini,
        nac_rango_fin: p.nac_rango_fin,
        nac_lugar_id: p.nac_lugar_id,
        defuncion_fecha: p.viva === "si" ? null : p.defuncion_fecha,
        defuncion_lugar_id: p.viva === "si" ? null : p.defuncion_lugar_id,
        bautismo_fecha: p.bautismo_fecha,
        bautismo_lugar_id: p.bautismo_lugar_id,
        matrimonio_fecha: p.matrimonio_fecha,
        matrimonio_lugar_id: p.matrimonio_lugar_id,
        entierro_fecha: p.entierro_fecha,
        entierro_lugar_id: p.entierro_lugar_id,
        ocupacion: p.ocupacion || null,
        nacionalidad: p.nacionalidad || null,
        religion: p.religion || null,
        notas: p.notas || null,
        certeza: p.certeza,
      };
      const activeTreeId = await getActiveTreeId(user.id);
      const { data, error } = await supabase.from("personas").insert(withTreeScope(payload, activeTreeId)).select().single();
      if (error) throw error;
      toast.success("Persona agregada");
      navigate(after === "tree" ? "/arbol" : `/personas/${data.id}`);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <Helmet>
        <title>Agregar persona · GENEAI</title>
        <meta name="description" content="Agrega una nueva persona a tu árbol genealógico." />
      </Helmet>

      {/* Top bar estilo FamilySearch */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Cerrar"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-bold tracking-tight">Agregar persona</h1>
          <Button
            onClick={() => save("detail")}
            disabled={!canContinue || busy}
            className="rounded-full px-5"
          >
            {busy ? "…" : "Continuar"}
          </Button>
        </div>
        <div className="h-[3px] w-full bg-primary/80" />
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-32 pt-4">
        {/* Sexo */}
        <div className="py-2">
          <Segmented
            value={(p.sexo || "otro") as "masculino" | "femenino" | "otro"}
            onChange={(v) => set("sexo", v)}
            options={[
              { value: "masculino", label: "Hombre" },
              { value: "femenino", label: "Mujer" },
              { value: "otro", label: "Desconocido" },
            ]}
          />
        </div>

        {/* Nombre */}
        <FieldLine label="Nombres">
          <LineInput
            value={p.nombres}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombres"
            autoFocus
          />
        </FieldLine>
        <FieldLine label="Apellidos">
          <LineInput
            value={p.apellidos}
            onChange={(e) => set("apellidos", e.target.value)}
            placeholder="Apellidos"
          />
        </FieldLine>
        <FieldLine label="Sufijo" optional>
          <LineInput
            value={p.sufijo}
            onChange={(e) => set("sufijo", e.target.value)}
            placeholder="Jr., III, …"
          />
        </FieldLine>

        {/* Vive / Fallecido */}
        <div className="py-4">
          <Segmented
            value={p.viva === "no" ? "no" : "si"}
            onChange={(v) => set("viva", v)}
            options={[
              { value: "no", label: "Fallecido(a)" },
              { value: "si", label: "Vive" },
            ]}
          />
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
            GENEAI protege la privacidad: los parientes vivos que agregues solo son visibles para ti.
          </p>
        </div>

        {/* Nacimiento */}
        <FieldLine label="Fecha de nacimiento" optional>
          <LineInput
            type="date"
            value={p.nac_fecha ?? ""}
            onChange={(e) => setBirthDate(e.target.value || null)}
          />
        </FieldLine>
        <FieldLine label="Fecha aproximada" optional>
          <LineInput
            value={p.nac_fecha_aprox}
            onChange={(e) => set("nac_fecha_aprox", e.target.value)}
            placeholder="hacia 1880"
          />
        </FieldLine>
        <FieldLine label="Lugar de nacimiento" optional>
          <div className="-mx-1">
            <LugarSelect
              value={p.nac_lugar_id}
              onChange={setBirthPlace}
              lugares={lugares}
              onLugaresChange={setLugares}
            />
          </div>
        </FieldLine>

        {/* Defunción (sólo si fallecido) */}
        {p.viva !== "si" && (
          <>
            <FieldLine label="Fecha de defunción" optional>
              <LineInput
                type="date"
                value={p.defuncion_fecha ?? ""}
                onChange={(e) => set("defuncion_fecha", e.target.value || null)}
              />
            </FieldLine>
            <FieldLine label="Lugar de defunción" optional>
              <div className="-mx-1">
                <LugarSelect
                  value={p.defuncion_lugar_id}
                  onChange={(v) => set("defuncion_lugar_id", v)}
                  lugares={lugares}
                  onLugaresChange={setLugares}
                />
              </div>
            </FieldLine>
          </>
        )}

        {/* Más detalles */}
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          className="mt-6 flex w-full items-center justify-between rounded-2xl bg-muted/60 px-4 py-3 text-left text-sm font-semibold hover:bg-muted"
        >
          Más detalles
          <ChevronDown className={cn("h-4 w-4 transition-transform", moreOpen && "rotate-180")} />
        </button>

        {moreOpen && (
          <div className="mt-2">
            <FieldLine label="Rango de nacimiento (años)" optional>
              <div className="flex gap-3">
                <LineInput
                  type="number"
                  placeholder="desde"
                  value={p.nac_rango_ini ?? ""}
                  onChange={(e) => setBirthRangeStart(e.target.value ? parseInt(e.target.value) : null)}
                />
                <LineInput
                  type="number"
                  placeholder="hasta"
                  value={p.nac_rango_fin ?? ""}
                  onChange={(e) => set("nac_rango_fin", e.target.value ? parseInt(e.target.value) : null)}
                />
              </div>
            </FieldLine>

            <FieldLine label="Fecha de bautismo" optional>
              <LineInput type="date" value={p.bautismo_fecha ?? ""} onChange={(e) => set("bautismo_fecha", e.target.value || null)} />
            </FieldLine>
            <FieldLine label="Lugar de bautismo" optional>
              <div className="-mx-1">
                <LugarSelect value={p.bautismo_lugar_id} onChange={(v) => set("bautismo_lugar_id", v)} lugares={lugares} onLugaresChange={setLugares} />
              </div>
            </FieldLine>

            <FieldLine label="Fecha de matrimonio" optional>
              <LineInput type="date" value={p.matrimonio_fecha ?? ""} onChange={(e) => set("matrimonio_fecha", e.target.value || null)} />
            </FieldLine>
            <FieldLine label="Lugar de matrimonio" optional>
              <div className="-mx-1">
                <LugarSelect value={p.matrimonio_lugar_id} onChange={(v) => set("matrimonio_lugar_id", v)} lugares={lugares} onLugaresChange={setLugares} />
              </div>
            </FieldLine>

            <FieldLine label="Fecha de entierro" optional>
              <LineInput type="date" value={p.entierro_fecha ?? ""} onChange={(e) => set("entierro_fecha", e.target.value || null)} />
            </FieldLine>
            <FieldLine label="Lugar de entierro" optional>
              <div className="-mx-1">
                <LugarSelect value={p.entierro_lugar_id} onChange={(v) => set("entierro_lugar_id", v)} lugares={lugares} onLugaresChange={setLugares} />
              </div>
            </FieldLine>

            <FieldLine label="Ocupación" optional>
              <LineInput value={p.ocupacion} onChange={(e) => set("ocupacion", e.target.value)} placeholder="agricultor, maestra…" />
            </FieldLine>
            <FieldLine label="Nacionalidad / origen" optional>
              <LineInput value={p.nacionalidad} onChange={(e) => set("nacionalidad", e.target.value)} />
            </FieldLine>
            <FieldLine label="Religión / rito" optional>
              <LineInput value={p.religion} onChange={(e) => set("religion", e.target.value)} />
            </FieldLine>

            <FieldLine label="Variantes de nombre" optional>
              <LineInput
                value={(p.variantes_nombre ?? []).join(", ")}
                onChange={(e) => set("variantes_nombre", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                placeholder="separadas por coma"
              />
            </FieldLine>

            <div className="border-b border-border/60 py-3">
              <span className="block text-[13px] font-medium text-muted-foreground">Certeza</span>
              <Select value={p.certeza} onValueChange={(v) => set("certeza", v as any)}>
                <SelectTrigger className="mt-1 border-0 bg-transparent px-0 text-[17px] shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comprobado">Comprobado</SelectItem>
                  <SelectItem value="probable">Probable</SelectItem>
                  <SelectItem value="hipotesis">Hipótesis</SelectItem>
                  <SelectItem value="descartado">Descartado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <FieldLine label="Notas biográficas" optional>
              <Textarea
                rows={4}
                value={p.notas}
                onChange={(e) => set("notas", e.target.value)}
                className="border-0 px-0 text-[17px] shadow-none focus-visible:ring-0"
                placeholder="Anécdotas, fuentes, vínculos…"
              />
            </FieldLine>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1 rounded-full" onClick={() => save("tree")} disabled={!canContinue || busy}>
            Guardar e ir al árbol
          </Button>
          <Button className="flex-1 rounded-full" onClick={() => save("detail")} disabled={!canContinue || busy}>
            {busy ? "Guardando…" : "Guardar y abrir ficha"}
          </Button>
        </div>
      </main>
    </div>
  );
}
