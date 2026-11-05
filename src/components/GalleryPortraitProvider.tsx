import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeReload } from "@/hooks/use-realtime-reload";
import { createPhotoAccess } from "@/lib/photoAccess";
import { PhotoAccessContext } from "./PhotoImage";
import { GalleryPortraitContext } from "./PersonPortrait";

// Called once for the signed-in shell, when a visible portrait needs a fallback.
async function loadGalleryPortraits(userId: string, signal: AbortSignal) {
  const photos = new Map<string, string[]>();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from("fotos")
      .select("url,storage_path,personas_ids")
      .eq("user_id", userId).not("personas_ids", "eq", "{}")
      .order("created_at", { ascending: false }).order("id")
      .range(offset, offset + pageSize - 1).abortSignal(signal);
    if (error) throw error;
    for (const photo of data ?? []) {
      // Group photos are usable as portraits only when explicitly selected.
      if (photo.personas_ids?.length !== 1) continue;
      const id = photo.personas_ids[0];
      const urls = photos.get(id) ?? [];
      const fromStorage = photo.storage_path && `storage://fotos/${photo.storage_path}`;
      for (const url of [fromStorage, photo.url?.trim()]) {
        if (url && !urls.includes(url)) urls.push(url);
      }
      photos.set(id, urls);
    }
    if (!data || data.length < pageSize) break;
  }
  return photos;
}

export default function GalleryPortraitProvider({ userId, children }: { userId?: string; children: ReactNode }) {
  const [requested, setRequested] = useState(false);
  const [photos, setPhotos] = useState<Map<string, string[]>>(() => new Map());
  const request = useCallback(() => setRequested(true), []);
  const revision = useRealtimeReload(["fotos"], requested ? userId : undefined);
  useEffect(() => {
    if (!requested || !userId) return;
    const controller = new AbortController();
    loadGalleryPortraits(userId, controller.signal)
      .then(next => { if (!controller.signal.aborted) setPhotos(next); })
      .catch(() => { /* Saved portraits and initials remain available offline. */ });
    return () => controller.abort();
  }, [requested, userId, revision]);
  const access = useMemo(() => userId ? createPhotoAccess(userId, (paths, expiry) =>
    supabase.storage.from("fotos").createSignedUrls(paths, expiry)) : undefined, [userId]);
  const value = useMemo(() => ({ photos, request }), [photos, request]);
  return <PhotoAccessContext.Provider value={access}><GalleryPortraitContext.Provider value={value}>{children}</GalleryPortraitContext.Provider></PhotoAccessContext.Provider>;
}
