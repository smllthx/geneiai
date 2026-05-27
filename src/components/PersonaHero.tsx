import { useRef, useState } from "react";
import { User, Camera, Loader2 } from "lucide-react";
import CertezaBadge from "@/components/CertezaBadge";
import { personaCode } from "@/lib/personaCode";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const yearOf = (d?: string | null) => (d ? new Date(d).getUTCFullYear() : null);

export default function PersonaHero({ p, onUpdated }: { p: any; onUpdated?: (patch: any) => void }) {
  const yN = yearOf(p?.nac_fecha) ?? p?.nac_rango_ini ?? null;
  const yD = yearOf(p?.defuncion_fecha) ?? null;
  const lifespan = yN || yD ? `${yN ?? "?"} – ${yD ?? (p?.viva === "si" ? "vive" : "?")}` : "";
  const edad = yN && yD ? `${yD - yN} años` : (yN && p?.viva === "si" ? `${new Date().getUTCFullYear() - yN} años` : null);
  const sexoIcon = p?.sexo === "femenino" ? "♀" : p?.sexo === "masculino" ? "♂" : "";
  const ring = p?.sexo === "femenino" ? "ring-pink-400/50"
    : p?.sexo === "masculino" ? "ring-sky-400/50"
    : "ring-primary/30";

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const uploadPortrait = async (file: File) => {
    if (!p?.id) return;
    setUploading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user!;
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/retrato-${p.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("fotos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("fotos").getPublicUrl(path);
      const { error: updErr } = await supabase.from("personas").update({ foto_url: publicUrl }).eq("id", p.id);
      if (updErr) throw updErr;
      toast.success("Retrato actualizado");
      onUpdated?.({ foto_url: publicUrl });
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo subir el retrato");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="-mx-3 mb-0 overflow-hidden border-y border-border bg-zinc-900 text-white md:mx-0 md:mb-4 md:rounded-2xl md:border">
      <div className="flex items-center gap-4 px-4 py-5 md:px-6">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title={p?.foto_url ? "Cambiar retrato" : "Subir retrato"}
          className={`group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 ring-2 ${ring} md:h-28 md:w-28`}
        >
          {p?.foto_url ? (
            <img src={p.foto_url} alt={`${p.nombres ?? ""} ${p.apellidos ?? ""}`} className="h-full w-full object-cover" />
          ) : (
            <User className="h-12 w-12 text-white/45" />
          )}
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1 text-[10px] font-semibold uppercase tracking-wider text-white opacity-0 transition-opacity group-hover:opacity-100">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
            {uploading ? "Subiendo" : (p?.foto_url ? "Cambiar" : "Subir")}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPortrait(f); }}
          />
        </button>
        <div className="min-w-0 flex-1 text-left">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
            <span className="gen-country">{p?.nacionalidad || "Ficha genealógica"}</span>
          </p>
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
            <span className="gen-name">{p?.nombres}</span> <span className="gen-surname">{p?.apellidos}</span>
            {sexoIcon && <span className="ml-2 text-xl font-semibold text-white/55">{sexoIcon}</span>}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[15px] font-medium text-white/65">
            {lifespan && <span className="font-semibold">{lifespan}</span>}
            {edad && <><span>·</span><span>{edad}</span></>}
            {p?.ocupacion && <><span>·</span><span className="font-semibold">{p.ocupacion}</span></>}
            {p?.id && (
              <>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(personaCode(p.id)); toast.success("Código copiado"); }}
                  className="rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 font-mono text-[11px] tracking-wider text-white/70 hover:bg-white/15"
                  title="Código único — toca para copiar"
                >
                  {personaCode(p.id)}
                </button>
              </>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {p?.certeza && <CertezaBadge value={p.certeza} />}
            {p?.viva === "si" && <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/75">Persona viva — privada</span>}
            {p?.religion && <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/75">{p.religion}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
