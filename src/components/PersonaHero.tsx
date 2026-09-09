import { useRef, useState } from "react";
import { User, Camera, Loader2 } from "lucide-react";
import CertezaBadge from "@/components/CertezaBadge";
import { personaCode } from "@/lib/personaCode";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const yearOf = (d?: string | null) => (d ? new Date(d).getUTCFullYear() : null);
const originTheme = (origin?: string | null) => {
  const o = (origin ?? "").toLowerCase();
  if (o.includes("ital")) return "from-emerald-500/25 via-white/5 to-red-500/20";
  if (o.includes("suiz") || o.includes("switz")) return "from-red-500/25 via-white/5 to-red-500/15";
  if (o.includes("chil")) return "from-blue-500/25 via-white/5 to-red-500/20";
  if (o.includes("espa")) return "from-amber-500/25 via-red-500/10 to-amber-500/20";
  if (o.includes("fran")) return "from-blue-500/25 via-white/5 to-red-500/20";
  if (o.includes("alem") || o.includes("german")) return "from-zinc-700/40 via-red-500/10 to-amber-500/25";
  return "from-cyan-500/20 via-fuchsia-500/10 to-amber-500/15";
};

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
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);

  const cropImage = (file: File, zoom: number, x: number, y: number) => new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const source = Math.min(img.naturalWidth, img.naturalHeight) / zoom;
      const sx = Math.max(0, Math.min(img.naturalWidth - source, (img.naturalWidth - source) / 2 + x * (img.naturalWidth - source) / 2));
      const sy = Math.max(0, Math.min(img.naturalHeight - source, (img.naturalHeight - source) / 2 + y * (img.naturalHeight - source) / 2));
      const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 640;
      const ctx = canvas.getContext("2d"); if (!ctx) return reject(new Error("Canvas no disponible"));
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, source, source, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo recortar la imagen")), "image/jpeg", .9);
    };
    img.onerror = () => reject(new Error("No se pudo leer la imagen"));
    img.src = URL.createObjectURL(file);
  });

  const uploadPortrait = async (file: File, zoom: number, x: number, y: number) => {
    if (!p?.id) return;
    setUploading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user!;
      const cropped = await cropImage(file, zoom, x, y);
      const path = `${user.id}/retrato-${p.id}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("fotos").upload(path, cropped, { upsert: true, contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("fotos").getPublicUrl(path);
      const { error: updErr } = await supabase.from("personas").update({ foto_url: publicUrl }).eq("id", p.id);
      if (updErr) throw updErr;
      toast.success("Retrato actualizado");
      onUpdated?.({ foto_url: publicUrl });
      setCropFile(null); setCropUrl(null);
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo subir el retrato");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
    <div className={`archivo-card -mx-3 mb-0 overflow-hidden border-y border-border bg-gradient-to-br ${originTheme(p?.nacionalidad)} text-foreground md:mx-0 md:mb-4 md:rounded-2xl md:border`}>
      <div className="flex items-center gap-4 px-4 py-5 md:px-6">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title={p?.foto_url ? "Cambiar retrato" : "Subir retrato"}
          className={`group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card/70 ring-2 ${ring} md:h-28 md:w-28`}
        >
          {p?.foto_url ? (
            <img src={p.foto_url} alt={`${p.nombres ?? ""} ${p.apellidos ?? ""}`} className="h-full w-full object-cover" />
          ) : (
            <User className="h-12 w-12 text-muted-foreground" />
          )}
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-foreground/70 py-1 text-[10px] font-semibold uppercase tracking-wider text-background opacity-0 transition-opacity group-hover:opacity-100">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
            {uploading ? "Subiendo" : (p?.foto_url ? "Cambiar" : "Subir")}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { setCropFile(f); setCropUrl(URL.createObjectURL(f)); setCropZoom(1); setCropX(0); setCropY(0); } }}
          />
        </button>
        <div className="min-w-0 flex-1 text-left">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span className="gen-country">{p?.nacionalidad || "Ficha genealógica"}</span>
          </p>
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
            <span className="gen-name">{p?.nombres}</span> <span className="gen-surname">{p?.apellidos}</span>
            {sexoIcon && <span className="ml-2 text-xl font-semibold text-muted-foreground">{sexoIcon}</span>}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[15px] font-medium text-muted-foreground">
            {lifespan && <span className="font-semibold">{lifespan}</span>}
            {edad && <><span>·</span><span>{edad}</span></>}
            {p?.ocupacion && <><span>·</span><span className="font-semibold">{p.ocupacion}</span></>}
            {p?.id && (
              <>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(personaCode(p.id)); toast.success("Código copiado"); }}
                  className="rounded-md border border-border bg-card/60 px-1.5 py-0.5 font-mono text-[11px] tracking-wider text-muted-foreground hover:bg-card"
                  title="Código único — toca para copiar"
                >
                  {personaCode(p.id)}
                </button>
              </>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {p?.certeza && <CertezaBadge value={p.certeza} />}
            {p?.viva === "si" && <span className="rounded-full bg-card/60 px-2 py-1 text-xs text-muted-foreground">Persona viva — privada</span>}
            {p?.religion && <span className="rounded-full bg-card/60 px-2 py-1 text-xs text-muted-foreground">{p.religion}</span>}
          </div>
        </div>
      </div>
    </div>
    <Dialog open={!!cropFile} onOpenChange={(open) => { if (!open && !uploading) { setCropFile(null); setCropUrl(null); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Elegir encuadre del retrato</DialogTitle></DialogHeader>
        {cropUrl && <div className="mx-auto h-64 w-64 overflow-hidden rounded-3xl border border-primary/25 bg-muted/40">
          <img src={cropUrl} alt="Vista previa del retrato" className="h-full w-full object-cover" style={{ objectPosition: `${50 + cropX * 25}% ${50 + cropY * 25}%`, transform: `scale(${cropZoom})` }} />
        </div>}
        <div className="space-y-3 text-sm">
          <label className="grid gap-1">Zoom <input type="range" min="1" max="2.5" step=".05" value={cropZoom} onChange={(e) => setCropZoom(Number(e.target.value))} /></label>
          <label className="grid gap-1">Horizontal <input type="range" min="-1" max="1" step=".05" value={cropX} onChange={(e) => setCropX(Number(e.target.value))} /></label>
          <label className="grid gap-1">Vertical <input type="range" min="-1" max="1" step=".05" value={cropY} onChange={(e) => setCropY(Number(e.target.value))} /></label>
        </div>
        <Button onClick={() => cropFile && void uploadPortrait(cropFile, cropZoom, cropX, cropY)} disabled={!cropFile || uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {uploading ? "Guardando…" : "Usar este retrato"}
        </Button>
      </DialogContent>
    </Dialog>
    </>
  );
}
