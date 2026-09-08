import { useSyncExternalStore } from "react";

// Keep compact navigation on a phone rotated to landscape as well.
export const COMPACT_NAV_QUERY = "(max-width: 767px), (pointer: coarse) and (max-height: 500px) and (max-width: 1023px)";
let media: MediaQueryList | undefined;
const getMedia = () => media ??= window.matchMedia(COMPACT_NAV_QUERY);
const subscribe = (listener: () => void) => {
  const query = getMedia();
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};
const getSnapshot = () => getMedia().matches;
const getServerSnapshot = () => false;

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
