import { useEffect, useState } from "react";

export type DeviceKind = "phone" | "phablet" | "tablet" | "laptop" | "desktop" | "tv";
export type Orientation = "portrait" | "landscape";

export interface DeviceInfo {
  width: number;
  height: number;
  dpr: number;
  /** diagonal in CSS-inches (approx, assumes 96dpi CSS reference) */
  diagonalIn: number;
  kind: DeviceKind;
  orientation: Orientation;
  touch: boolean;
  coarsePointer: boolean;
  ua: string;
  isIOS: boolean;
  isAndroid: boolean;
  isStandalone: boolean;
}

function classify(w: number, h: number): DeviceKind {
  const min = Math.min(w, h);
  const max = Math.max(w, h);
  if (min < 480) return "phone";
  if (min < 600) return "phablet";
  if (min < 900) return "tablet";
  if (max < 1440) return "laptop";
  if (max < 2200) return "desktop";
  return "tv";
}

function read(): DeviceInfo {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  // CSS pixels are ~96 per inch reference
  const diagonalIn = Math.sqrt(w * w + h * h) / 96;
  const ua = navigator.userAgent;
  return {
    width: w,
    height: h,
    dpr,
    diagonalIn,
    kind: classify(w, h),
    orientation: w >= h ? "landscape" : "portrait",
    touch: matchMedia("(pointer: coarse)").matches || "ontouchstart" in window,
    coarsePointer: matchMedia("(pointer: coarse)").matches,
    ua,
    isIOS: /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document),
    isAndroid: /Android/i.test(ua),
    isStandalone:
      matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS
      window.navigator.standalone === true,
  };
}

export function useDevice(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>(() =>
    typeof window === "undefined"
      ? {
          width: 1280, height: 800, dpr: 1, diagonalIn: 15,
          kind: "laptop", orientation: "landscape", touch: false, coarsePointer: false,
          ua: "", isIOS: false, isAndroid: false, isStandalone: false,
        }
      : read()
  );

  useEffect(() => {
    let raf = 0;
    const onChange = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setInfo(read()));
    };
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
      cancelAnimationFrame(raf);
    };
  }, []);

  return info;
}
