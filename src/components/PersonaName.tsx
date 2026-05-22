import { Link } from "react-router-dom";
import { personaCode } from "@/lib/personaCode";
import { cn } from "@/lib/utils";

interface Props {
  persona: { id?: string; nombres?: string | null; apellidos?: string | null } | null | undefined;
  showCode?: boolean;
  asLink?: boolean;
  className?: string;
  size?: "sm" | "md";
}

/** Renderiza un nombre con apellidos y nombres en negrita + código de identificación opcional. */
export default function PersonaName({ persona, showCode = true, asLink = true, className, size = "md" }: Props) {
  if (!persona) return null;
  const nm = (persona.nombres ?? "").trim();
  const ap = (persona.apellidos ?? "").trim();
  const txtSize = size === "sm" ? "text-[15px]" : "text-[17px]";
  const codeSize = size === "sm" ? "text-[10px]" : "text-[11px]";

  const inner = (
    <span className={cn("inline-flex flex-wrap items-baseline gap-1.5", className)}>
      {nm && <span className={cn("gen-name font-extrabold text-foreground", txtSize)}>{nm}</span>}
      {ap && <span className={cn("gen-surname font-extrabold text-foreground", txtSize)}>{ap}</span>}
      {showCode && persona.id && (
        <span className={cn("rounded-md border border-border/60 bg-foreground/5 px-1 py-0 font-mono font-semibold tracking-wider text-muted-foreground", codeSize)}>
          {personaCode(persona.id)}
        </span>
      )}
    </span>
  );

  if (asLink && persona.id) {
    return (
      <Link to={`/personas/${persona.id}`} className="hover:text-primary">{inner}</Link>
    );
  }
  return inner;
}
