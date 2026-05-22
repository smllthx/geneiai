import { useEffect } from "react";

/**
 * Ensures the currently focused input/textarea/contenteditable stays visible
 * above the on-screen keyboard on mobile. Uses VisualViewport API when
 * available and falls back to scrollIntoView.
 */
export default function KeyboardAwareScroller() {
  useEffect(() => {
    const isEditable = (el: Element | null): el is HTMLElement => {
      if (!el || !(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        const t = (el as HTMLInputElement).type;
        return !["checkbox", "radio", "button", "submit", "reset", "file", "range", "color", "hidden"].includes(t);
      }
      return el.isContentEditable;
    };

    const scrollFocusedIntoView = () => {
      const el = document.activeElement;
      if (!isEditable(el)) return;
      const vv = window.visualViewport;
      const viewportH = vv?.height ?? window.innerHeight;
      const viewportTop = vv?.offsetTop ?? 0;
      const rect = el.getBoundingClientRect();
      // We want the input to sit ~16px above the keyboard line (bottom of visualViewport)
      const margin = 24;
      const desiredBottom = viewportTop + viewportH - margin;
      const desiredTop = viewportTop + margin + 56; // leave room for app top bar
      let delta = 0;
      if (rect.bottom > desiredBottom) {
        delta = rect.bottom - desiredBottom;
      } else if (rect.top < desiredTop) {
        delta = rect.top - desiredTop;
      }
      if (delta !== 0) {
        window.scrollBy({ top: delta, behavior: "smooth" });
      }
    };

    const onFocusIn = (_e: FocusEvent) => {
      // Wait a tick so the keyboard starts opening and visualViewport shrinks
      setTimeout(scrollFocusedIntoView, 250);
      setTimeout(scrollFocusedIntoView, 550);
    };

    const onViewportChange = () => {
      // Keyboard appears/disappears or rotates — re-align focused field
      scrollFocusedIntoView();
    };

    document.addEventListener("focusin", onFocusIn);
    window.visualViewport?.addEventListener("resize", onViewportChange);
    window.visualViewport?.addEventListener("scroll", onViewportChange);

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      window.visualViewport?.removeEventListener("resize", onViewportChange);
      window.visualViewport?.removeEventListener("scroll", onViewportChange);
    };
  }, []);

  return null;
}
