import BrandLogo from "@/components/BrandLogo";

export default function SectionPlaceholder({ session = false }: { session?: boolean }) {
  return <div role="status" aria-label={session ? "Verificando sesión" : "Abriendo sección"} className={`section-placeholder ${session ? "session-placeholder" : ""}`}>
    {session && <div className="mb-8"><BrandLogo size={44} showText /><p className="mt-3 text-sm text-muted-foreground">Tu archivo familiar, conectado.</p></div>}
    <div aria-hidden="true" className="space-y-4">
      <div className="placeholder-line w-2/5" /><div className="placeholder-line w-3/5" />
      <div className="grid gap-4 sm:grid-cols-2"><div className="placeholder-card" /><div className="placeholder-card" /></div>
    </div>
    <span className="sr-only">{session ? "Comprobando el acceso a tu archivo." : "Preparando esta sección."}</span>
  </div>;
}
