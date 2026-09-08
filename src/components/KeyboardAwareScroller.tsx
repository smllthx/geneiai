import { useEffect } from "react";

/** Publish visible viewport bounds without rerendering the application. */
export default function KeyboardAwareScroller() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;
    let focusTimer = 0;
    let ensureVisible = false;
    const editable = (element: Element | null): element is HTMLElement => {
      if (!(element instanceof HTMLElement)) return false;
      if (element.isContentEditable || element.tagName === "TEXTAREA") return true;
      return element instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "reset", "file", "range", "color", "hidden"].includes(element.type);
    };
    const update = () => {
      frame = 0;
      const height = viewport?.height ?? window.innerHeight;
      const top = viewport?.offsetTop ?? 0;
      const left = viewport?.offsetLeft ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const active = document.activeElement;
      const rect = editable(active) ? active.getBoundingClientRect() : null;
      const keyboard = editable(active) && (viewport?.scale ?? 1) === 1 && window.innerHeight - height > 150;
      root.style.setProperty("--visual-viewport-height", `${height}px`);
      root.style.setProperty("--visual-viewport-width", `${width}px`);
      root.style.setProperty("--visual-viewport-top", `${top}px`);
      root.style.setProperty("--visual-viewport-left", `${left}px`);
      root.dataset.keyboardOpen = String(keyboard);
      if (ensureVisible && rect && (rect.bottom > top + height - 24 || rect.top < top + 24)) {
        // Scroll the actual ancestor (including a sheet/dialog), without an
        // animated scroll loop during visualViewport scroll events.
        active.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
      }
      ensureVisible = false;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const onResize = () => { ensureVisible = true; schedule(); };
    const onFocus = () => {
      schedule();
      clearTimeout(focusTimer);
      focusTimer = window.setTimeout(onResize, 300);
    };
    update();
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onFocus);
    window.addEventListener("resize", onResize, { passive: true });
    viewport?.addEventListener("resize", onResize, { passive: true });
    viewport?.addEventListener("scroll", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(focusTimer);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onFocus);
      window.removeEventListener("resize", onResize);
      viewport?.removeEventListener("resize", onResize);
      viewport?.removeEventListener("scroll", schedule);
      delete root.dataset.keyboardOpen;
    };
  }, []);
  return null;
}
