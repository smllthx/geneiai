import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, MapPin, Calendar, User, Heart, Users, Briefcase, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/compartir-persona`;

type Ficha = {
  id: string; nombres: string; apellidos: string; sexo?: string | null; foto_url?: string | null;
  nacimiento: { fecha?: string | null; anio?: number | null; lugar?: string | null };
  defuncion: { fecha?: string | null; anio?: number | null; lugar?: string | null };
  ocupacion?: string | null; nacionalidad?: string | null;
  padres: string[]; conyuges: string[]; hijos: string[];
};

export default function PersonaPublica() {
  const { id } = useParams<{ id: string }>();
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const r = await fetch(`${FN_URL}?id=${encodeURIComponent(id)}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "No disponible");
        setFicha(j.ficha);
        setBio(j.bio ?? "");
      } catch (e: any) {
        setError(e.message ?? "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: ficha ? `${ficha.nombres} ${ficha.apellidos}` : "Ficha genealógica", url });
      else { await navigator.clipboard.writeText(url); toast.success("Enlace copiado"); }
    } catch { /* user cancelled */ }
  };

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (error || !ficha) return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <p className="mb-2 font-semibold">No se pudo cargar la ficha</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    </div>
  );

  const vida = (() => {
    const a = ficha.nacimiento.anio, b = ficha.defuncion.anio;
    if (a && b) return `${a} — ${b}`;
    if (a) return `n. ${a}`;
    if (b) return `† ${b}`;
    return "";
  })();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-foreground/[0.02] px-4 py-10">
      <article className="mx-auto max-w-2xl">
        <div className="archivo-card overflow-hidden rounded-3xl">
          <div className="relative h-32 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent">
            <div className="absolute -bottom-12 left-6 grid h-24 w-24 place-items-center overflow-hidden rounded-full border-4 border-background bg-muted">
              {ficha.foto_url ? (
                <img src={ficha.foto_url} alt={`${ficha.nombres} ${ficha.apellidos}`} className="h-full w-full object-cover" />
              ) : (
                <User className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
          </div>

          <div className="px-6 pt-16 pb-8">
            <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-display text-3xl font-bold tracking-tight">{ficha.nombres} {ficha.apellidos}</h1>
                {vida && <p className="mt-1 text-sm text-muted-foreground">{vida}</p>}
              </div>
              <Button size="sm" variant="outline" onClick={share}><Share2 className="h-4 w-4" /> Compartir</Button>
            </div>

            {bio && (
              <p className="mt-4 rounded-2xl bg-foreground/5 p-4 text-sm leading-relaxed text-foreground/90">{bio}</p>
            )}

            <div className="mt-6 grid gap-3 text-sm">
              {ficha.nacimiento.lugar || ficha.nacimiento.fecha ? (
                <Row icon={<Calendar className="h-4 w-4" />} label="Nacimiento" value={[ficha.nacimiento.fecha, ficha.nacimiento.lugar].filter(Boolean).join(" · ")} />
              ) : null}
              {ficha.defuncion.lugar || ficha.defuncion.fecha ? (
                <Row icon={<Calendar className="h-4 w-4" />} label="Defunción" value={[ficha.defuncion.fecha, ficha.defuncion.lugar].filter(Boolean).join(" · ")} />
              ) : null}
              {ficha.ocupacion && <Row icon={<Briefcase className="h-4 w-4" />} label="Ocupación" value={ficha.ocupacion} />}
              {ficha.nacionalidad && <Row icon={<MapPin className="h-4 w-4" />} label="Nacionalidad" value={ficha.nacionalidad} />}
              {ficha.padres.length > 0 && <Row icon={<Users className="h-4 w-4" />} label="Padres" value={ficha.padres.join(" · ")} />}
              {ficha.conyuges.length > 0 && <Row icon={<Heart className="h-4 w-4" />} label="Cónyuge" value={ficha.conyuges.join(" · ")} />}
              {ficha.hijos.length > 0 && <Row icon={<Users className="h-4 w-4" />} label="Hijos" value={ficha.hijos.join(" · ")} />}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Ficha generada con <Link to="/" className="underline">GENEAI</Link>
        </p>
      </article>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/50 px-3 py-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="break-words text-sm">{value}</p>
      </div>
    </div>
  );
}
