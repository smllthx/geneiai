import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const KEY = "geneai:last-navigation-context";

export default function OfflineContextKeeper() {
  const location = useLocation();

  useEffect(() => {
    const save = () => {
      try {
        sessionStorage.setItem(KEY, JSON.stringify({
          path: `${location.pathname}${location.search}${location.hash}`,
          scrollY: window.scrollY,
          savedAt: new Date().toISOString(),
        }));
      } catch {}
    };
    save();
    const timer = window.setInterval(save, 5000);
    window.addEventListener("beforeunload", save);
    window.addEventListener("pagehide", save);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("beforeunload", save);
      window.removeEventListener("pagehide", save);
    };
  }, [location.pathname, location.search, location.hash]);

  return null;
}
