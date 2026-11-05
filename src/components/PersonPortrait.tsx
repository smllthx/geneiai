import { createContext, useContext, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const GalleryPortraitContext = createContext<{
  photos: ReadonlyMap<string, string[]>;
  request?: () => void;
}>({ photos: new Map() });

type Person = { id: string; nombres?: string | null; apellidos?: string | null; foto_url?: string | null };

export default function PersonPortrait({ person, personId = person?.id, src = person?.foto_url, name, className }: {
  person?: Person; personId?: string | null; src?: string | null; name?: string; className?: string;
}) {
  const { photos, request } = useContext(GalleryPortraitContext);
  const [failed, setFailed] = useState<string[]>([]);
  const primary = src?.trim();
  const needsGallery = !primary || failed.includes(primary);
  useEffect(() => {
    if (personId && needsGallery) request?.();
  }, [personId, needsGallery, request]);

  const url = !needsGallery ? primary : (personId && photos.get(personId)?.find(candidate => !failed.includes(candidate)));
  const fullName = name ?? [person?.nombres, person?.apellidos].filter(Boolean).join(" ");
  const initials = fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?";
  if (url) return <img key={url} src={url} alt={`Retrato de ${fullName}`} loading="lazy" decoding="async" onError={() => setFailed(prev => [...prev, url])} className={cn("object-cover object-[50%_35%]", className)} />;
  return <span role="img" aria-label={`Retrato de ${fullName}`} className={cn("inline-flex items-center justify-center bg-primary/10 text-sm font-semibold text-primary", className)}>{initials}</span>;
}
