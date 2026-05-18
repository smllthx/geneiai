import { User } from "lucide-react";
import CertezaBadge from "@/components/CertezaBadge";

const yearOf = (d?: string | null) => (d ? new Date(d).getUTCFullYear() : null);

export default function PersonaHero({ p }: { p: any }) {
  const yN = yearOf(p?.nac_fecha) ?? p?.nac_rango_ini ?? null;
  const yD = yearOf(p?.defuncion_fecha) ?? null;
  const lifespan = yN || yD ? `${yN ?? "?"} – ${yD ?? (p?.viva === "si" ? "vive" : "?")}` : "";
  const edad = yN && yD ? `${yD - yN} años` : (yN && p?.viva === "si" ? `${new Date().getUTCFullYear() - yN} años` : null);
  const sexoIcon = p?.sexo === "femenino" ? "♀" : p?.sexo === "masculino" ? "♂" : "";
  const ring = p?.sexo === "femenino" ? "ring-pink-400/50"
    : p?.sexo === "masculino" ? "ring-sky-400/50"
    : "ring-primary/30";

  return (
    <div className="glass-strong relative mb-5 overflow-hidden rounded-3xl p-5 md:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(at 0% 0%, hsl(var(--mesh-1)/0.25) 0, transparent 50%), radial-gradient(at 100% 100%, hsl(var(--mesh-2)/0.25) 0, transparent 50%)",
        }}
      />
      <div className="relative flex flex-col items-center gap-5 text-center">
        <div className={`flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-foreground/5 ring-4 ${ring} md:h-32 md:w-32`}>
          {p?.foto_url ? (
            <img src={p.foto_url} alt={`${p.nombres ?? ""} ${p.apellidos ?? ""}`} className="h-full w-full object-cover" />
          ) : (
            <User className="h-12 w-12 text-foreground/40" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {p?.nacionalidad || "Ficha genealógica"}
          </p>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            {p?.nombres} {p?.apellidos} {sexoIcon && <span className="ml-1 text-2xl text-muted-foreground">{sexoIcon}</span>}
          </h1>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
            {lifespan && <span>{lifespan}</span>}
            {edad && <><span>·</span><span>{edad}</span></>}
            {p?.ocupacion && <><span>·</span><span>{p.ocupacion}</span></>}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {p?.certeza && <CertezaBadge value={p.certeza} />}
            {p?.viva === "si" && <span className="glass-pill">Persona viva — privada</span>}
            {p?.religion && <span className="glass-pill">{p.religion}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
