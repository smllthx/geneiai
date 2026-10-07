import { useState } from "react";
import { cn } from "@/lib/utils";

export default function PersonPortrait({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?";
  if (src && failed !== src) return <img src={src} alt={`Retrato de ${name}`} loading="lazy" decoding="async" onError={() => setFailed(src)} className={className} />;
  return <span role="img" aria-label={`Retrato de ${name}`} className={cn("inline-flex items-center justify-center bg-primary/10 text-sm font-semibold text-primary", className)}>{initials}</span>;
}
