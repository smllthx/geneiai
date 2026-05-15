import { cn } from "@/lib/utils";

/**
 * Brand logo: a tree with intertwined roots & branches.
 * The strokes flow through the four heritage colors of the family:
 *   Switzerland · Spain · Chile · Italy
 * forming a single continuous lineage gradient.
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
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-label="Archivo Familiar Vivo"
      role="img"
    >
      <defs>
        {/* Heritage gradient: 🇨🇭 → 🇪🇸 → 🇨🇱 → 🇮🇹 */}
        <linearGradient id="heritage" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#DA291C" />   {/* Suiza */}
          <stop offset="35%" stopColor="#F1BF00" />  {/* España */}
          <stop offset="70%" stopColor="#0033A0" />  {/* Chile */}
          <stop offset="100%" stopColor="#008C45" /> {/* Italia */}
        </linearGradient>
        {withGlow && (
          <filter id="brandGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      <g
        fill="none"
        stroke="url(#heritage)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={withGlow ? "url(#brandGlow)" : undefined}
      >
        {/* Trunk */}
        <path d="M32 18 L32 46" />

        {/* Upper branches — curving and crossing */}
        <path d="M32 24 C 24 22, 20 16, 16 12" />
        <path d="M32 24 C 40 22, 44 16, 48 12" />
        <path d="M32 30 C 22 30, 16 26, 12 22" />
        <path d="M32 30 C 42 30, 48 26, 52 22" />
        <path d="M32 20 C 28 14, 30 10, 32 6" />
        <path d="M32 20 C 36 14, 34 10, 32 6" />

        {/* Roots — mirror the branches, intertwining */}
        <path d="M32 44 C 24 46, 20 52, 16 56" />
        <path d="M32 44 C 40 46, 44 52, 48 56" />
        <path d="M32 40 C 22 40, 16 44, 12 48" />
        <path d="M32 40 C 42 40, 48 44, 52 48" />
        <path d="M32 48 C 28 54, 30 58, 32 60" />
        <path d="M32 48 C 36 54, 34 58, 32 60" />
      </g>

      {/* Heart-node at the center: the family bond */}
      <circle cx="32" cy="32" r="2.4" fill="url(#heritage)" />
    </svg>
  );
}
