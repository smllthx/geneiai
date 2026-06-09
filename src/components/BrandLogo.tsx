import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

/**
 * GENEAI brand logo.
 * Logo limpio: sin borde, círculo, halo ni contenedor decorativo.
 */
export default function BrandLogo({
  className,
  size = 44,
  interactive = false,
}: {
  className?: string;
  size?: number;
  interactive?: boolean;
}) {
  const inner = (
    <img
      src={logo}
      alt="GENEAI"
      width={size}
      height={size}
      className="block object-contain"
      style={{ width: size, height: size }}
      draggable={false}
    />
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
