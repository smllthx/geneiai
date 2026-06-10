import { useCallback, useEffect, useRef, useState } from "react";

type NetworkQuality = "online" | "offline" | "checking";

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkQuality>(() => {
    if (typeof navigator === "undefined") return "checking";
    return navigator.onLine ? "checking" : "offline";
  });
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const mounted = useRef(true);

  const check = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      setLastCheckedAt(new Date());
      return false;
    }

    setStatus((current) => current === "offline" ? "checking" : current);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(`/api/health?ts=${Date.now()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!mounted.current) return false;
      const ok = response.ok;
      setStatus(ok ? "online" : "offline");
      setLastCheckedAt(new Date());
      return ok;
    } catch {
      if (!mounted.current) return false;
      setStatus("offline");
      setLastCheckedAt(new Date());
      return false;
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const online = () => { void check(); };
    const offline = () => {
      setStatus("offline");
      setLastCheckedAt(new Date());
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    void check();
    const timer = window.setInterval(check, 30_000);
    return () => {
      mounted.current = false;
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.clearInterval(timer);
    };
  }, [check]);

  return {
    isOnline: status === "online",
    isOffline: status === "offline",
    isChecking: status === "checking",
    lastCheckedAt,
    retry: check,
  };
}
