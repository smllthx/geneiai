import { cn } from "@/lib/utils";
import logo from "@/assets/logo-tree.png";

/**
 * GENEAI brand logo.
 * Logo limpio: sin borde, círculo, halo ni contenedor decorativo.
 */
export default function BrandLogo({
  className,
  size = 44,
  interactive = false,
  showText = false,
  textPosition = "right",
  subtitle,
}: {
  className?: string;
  size?: number;
  interactive?: boolean;
  showText?: boolean;
  textPosition?: "right" | "bottom";
  subtitle?: string;
}) {
  const image = (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden"
      style={{ width: size, height: size }}
    >
      <img
        src={logo}
        alt="GENEAI"
        width={size}
        height={size}
        className="block scale-[1.18] object-contain"
        style={{ width: size, height: size }}
        draggable={false}
      />
    </span>
  );

  const inner = (
    <span className={cn(
      "inline-flex shrink-0 items-center",
      showText && textPosition === "bottom" ? "flex-col gap-1.5 text-center" : "gap-3",
    )}>
      {image}
      {showText && (
        <span className="min-w-0 leading-none">
          <span className="block font-display text-xl font-semibold tracking-tight text-foreground">GENEAI</span>
          {subtitle && <span className="mt-1 block text-[11px] leading-tight text-muted-foreground">{subtitle}</span>}
        </span>
      )}
    </span>
  );

  if (!interactive) {
    return <span className={cn("inline-flex shrink-0 items-center justify-center", className)}>{inner}</span>;
  }
  return (
    <button
      type="button"
      aria-label="GENEAI"
      className={cn("inline-flex shrink-0 items-center justify-center outline-none transition-transform hover:scale-105 active:scale-95", className)}
    >
      {inner}
    </button>
  );
}
