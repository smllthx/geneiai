import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

/**
 * GenAI brand logo (árbol de la vida con raíces y ramas entrelazadas).
 */
export default function BrandLogo({
  className,
  size = 28,
  withGlow = false,
}: {
  className?: string;
  size?: number;
  withGlow?: boolean;
}) {
  return (
    <img
      src={logo}
      width={size}
      height={size}
      alt="GenAI"
      className={cn(
        "shrink-0 object-contain",
        withGlow && "drop-shadow-[0_0_12px_hsl(var(--primary)/0.5)]",
        className,
      )}
    />
  );
}
