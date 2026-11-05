import { createContext, useContext, useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { photoStoragePath, type createPhotoAccess } from "@/lib/photoAccess";

export const PhotoAccessContext = createContext<ReturnType<typeof createPhotoAccess> | undefined>(undefined);

export default function PhotoImage({ src, storagePath, onUnavailable, ...props }: ImgHTMLAttributes<HTMLImageElement> & {
  storagePath?: string | null; onUnavailable?: () => void;
}) {
  const access = useContext(PhotoAccessContext);
  const path = storagePath || photoStoragePath(src);
  const [signed, setSigned] = useState<{ path: string; url: string } | null>(null);
  const onFailure = useRef(onUnavailable);
  onFailure.current = onUnavailable;
  useEffect(() => {
    if (!access || !path) {
      if (!access && src?.startsWith("storage://")) onFailure.current?.();
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const renew = async () => {
      const next = await access(path);
      if (!active) return;
      if (!next) { onFailure.current?.(); return; }
      setSigned({ path, url: next.url });
      timer = setTimeout(() => { void renew(); }, Math.max(1000, next.expires - Date.now()));
    };
    void renew();
    return () => { active = false; clearTimeout(timer); };
  }, [access, path, src]);
  // Public profile routes receive only the URL granted by their own backend.
  const url = path && access ? (signed?.path === path ? signed.url : undefined) : (src?.startsWith("storage://") ? undefined : src);
  if (!url) return <span role={props.alt ? "img" : undefined} aria-label={props.alt || undefined} className={props.className} />;
  return <img {...props} src={url} onError={() => onFailure.current?.()} />;
}
