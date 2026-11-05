export default function SectionPlaceholder({ session = false }: { session?: boolean }) {
  return <span role="status" className="sr-only">{session ? "Verificando sesión" : "Abriendo sección"}</span>;
}
