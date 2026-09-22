/** Shared, centre-origin camera for every GENEAI tree layout.
 * Gesture frames update CSS, not React's person/relationship graph.
 */
export type Camera = Readonly<{ x: number; y: number; scale: number }>;
type Point = { x: number; y: number };
export const TREE_MIN_SCALE = 0.15;
export const TREE_MAX_SCALE = 3;
const INITIAL: Camera = { x: 0, y: 0, scale: 0.88 };
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Keep the same world point under the fingers, even at a zoom limit. */
export function anchoredCamera(start: Camera, from: Point, to: Point, ratio: number): Camera {
  if (!Number.isFinite(ratio) || ratio <= 0) return start;
  const scale = clamp(start.scale * ratio, TREE_MIN_SCALE, TREE_MAX_SCALE);
  const applied = scale / start.scale;
  return { x: to.x - (from.x - start.x) * applied, y: to.y - (from.y - start.y) * applied, scale };
}

export function createTreeViewport() {
  let camera: Camera = INITIAL;
  let element: HTMLDivElement | null = null;
  let frame = 0;
  let animation = 0;
  let lastPublishedScale = camera.scale;
  const listeners = new Set<() => void>();
  const pointers = new Map<number, Point>();
  let baseline: { camera: Camera; points: Point[] } | null = null;
  let moved = false;
  let pinched = false;
  let suppressUntil = 0;
  let lastTap: { point: Point; time: number } | null = null;
  let samples: { x: number; y: number; time: number }[] = [];
  let detach: (() => void) | undefined;

  const paint = () => {
    frame = 0;
    if (!element) return;
    element.style.setProperty("--tree-x", `${camera.x}px`);
    element.style.setProperty("--tree-y", `${camera.y}px`);
    element.style.setProperty("--tree-scale", String(camera.scale));
    if (camera.scale !== lastPublishedScale) {
      lastPublishedScale = camera.scale;
      listeners.forEach((listener) => listener());
    }
  };
  const update = (next: Camera) => {
    if (![next.x, next.y, next.scale].every(Number.isFinite)) return;
    camera = next;
    if (element && !frame) frame = requestAnimationFrame(paint);
  };
  const stop = () => { cancelAnimationFrame(animation); animation = 0; };
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const local = (point: Point): Point => {
    const rect = element!.getBoundingClientRect();
    return { x: point.x - rect.left - rect.width / 2, y: point.y - rect.top - rect.height / 2 };
  };
  const rebase = () => {
    baseline = pointers.size ? { camera, points: [...pointers.values()].slice(0, 2) } : null;
    samples = [{ x: camera.x, y: camera.y, time: performance.now() }];
  };
  const capture = () => pointers.forEach((_, id) => {
    try { element?.setPointerCapture(id); } catch { /* Pointer may already have ended. */ }
  });
  const release = (id: number) => {
    if (element?.hasPointerCapture(id)) element.releasePointerCapture(id);
  };
  const cancelGesture = () => {
    const ids = [...pointers.keys()];
    if (moved || pinched) suppressUntil = performance.now() + 400;
    pointers.clear();
    ids.forEach(release);
    baseline = null;
    samples = [];
    moved = false;
    pinched = false;
    lastTap = null;
    element?.removeAttribute("data-panning");
    stop();
  };
  const animateTo = (target: Camera) => {
    stop();
    if (!element || reducedMotion()) { update(target); return; }
    const start = camera;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 220);
      const ease = 1 - (1 - progress) ** 3;
      update({ x: start.x + (target.x - start.x) * ease, y: start.y + (target.y - start.y) * ease, scale: start.scale + (target.scale - start.scale) * ease });
      if (progress < 1) animation = requestAnimationFrame(tick);
      else animation = 0;
    };
    animation = requestAnimationFrame(tick);
  };
  const zoom = (ratio: number, anchor: Point = { x: 0, y: 0 }) => {
    cancelGesture();
    animateTo(anchoredCamera(camera, anchor, anchor, ratio));
  };
  const momentum = () => {
    if (reducedMotion() || samples.length < 2) return;
    const first = samples[0], last = samples[samples.length - 1];
    const elapsed = last.time - first.time;
    if (elapsed < 8 || performance.now() - last.time > 80) return;
    let vx = clamp((last.x - first.x) / elapsed, -2.5, 2.5);
    let vy = clamp((last.y - first.y) / elapsed, -2.5, 2.5);
    let previous = performance.now();
    const started = previous;
    const tick = (now: number) => {
      const dt = Math.min(40, now - previous);
      previous = now;
      const decay = Math.exp(-dt / 180);
      update({ ...camera, x: camera.x + vx * 180 * (1 - decay), y: camera.y + vy * 180 * (1 - decay) });
      vx *= decay; vy *= decay;
      if (Math.hypot(vx, vy) > 0.02 && now - started < 900) animation = requestAnimationFrame(tick);
      else animation = 0;
    };
    animation = requestAnimationFrame(tick);
  };
  const editable = (target: EventTarget | null) => target instanceof Element && !!target.closest("input,textarea,select,[contenteditable='true'],[data-tree-no-gesture]");
  const interactive = (target: EventTarget | null) => target instanceof Element && !!target.closest("button,a,article,[role='button']");

  const down = (event: PointerEvent) => {
    if ((event.pointerType === "mouse" && event.button !== 0) || editable(event.target)) return;
    stop();
    if (!pointers.size) { moved = false; pinched = false; suppressUntil = 0; }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) { pinched = true; moved = true; lastTap = null; capture(); }
    rebase();
  };
  const move = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId) || !baseline) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.values()].slice(0, 2);
    if (points.length === 2 && baseline.points.length === 2) {
      const originalDistance = distance(baseline.points[0], baseline.points[1]);
      if (originalDistance < 4) { rebase(); return; }
      update(anchoredCamera(baseline.camera, local(midpoint(baseline.points[0], baseline.points[1])), local(midpoint(points[0], points[1])), distance(points[0], points[1]) / originalDistance));
    } else if (points.length === 1) {
      const dx = points[0].x - baseline.points[0].x, dy = points[0].y - baseline.points[0].y;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      moved = true;
      capture();
      update({ ...baseline.camera, x: baseline.camera.x + dx, y: baseline.camera.y + dy });
      const now = performance.now();
      samples.push({ x: camera.x, y: camera.y, time: now });
      while (samples.length > 2 && now - samples[0].time > 80) samples.shift();
    }
    if (moved) element?.setAttribute("data-panning", "true");
    event.preventDefault();
  };
  const end = (event: PointerEvent) => {
    // Moving implicit touch capture from a card to the surface emits a bubbled
    // lostpointercapture on that card. It is not the end of our gesture.
    if (event.type === "lostpointercapture" && event.target !== element) return;
    if (!pointers.has(event.pointerId)) return;
    const canceled = event.type !== "pointerup";
    pointers.delete(event.pointerId);
    release(event.pointerId);
    if (moved || pinched) suppressUntil = performance.now() + 400;
    if (canceled) { cancelGesture(); return; }
    if (pointers.size) { rebase(); return; }
    baseline = null;
    element?.removeAttribute("data-panning");
    if (moved && !pinched) momentum();
    if (!moved && !pinched && event.pointerType === "touch" && !interactive(event.target)) {
      const point = { x: event.clientX, y: event.clientY }, now = performance.now();
      if (lastTap && now - lastTap.time < 300 && distance(lastTap.point, point) < 28) {
        zoom(1.5, local(point));
        lastTap = null;
      } else lastTap = { point, time: now };
    } else lastTap = null;
  };
  const click = (event: MouseEvent) => {
    // detail === 0 is keyboard/assistive activation: never discard it.
    if (event.detail && (pointers.size > 1 || performance.now() < suppressUntil)) {
      event.preventDefault(); event.stopPropagation();
    }
  };
  const wheel = (event: WheelEvent) => {
    if (editable(event.target) || pointers.size) return;
    event.preventDefault();
    stop();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element!.clientHeight : 1;
    if (event.ctrlKey || event.metaKey) {
      const anchor = local({ x: event.clientX, y: event.clientY });
      update(anchoredCamera(camera, anchor, anchor, Math.exp(clamp(-event.deltaY * unit * 0.01, -1, 1))));
    } else {
      // Trackpads keep their native two-axis scrolling and inertia.
      const dx = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
      const dy = event.shiftKey && !event.deltaX ? 0 : event.deltaY;
      update({ ...camera, x: camera.x - dx * unit, y: camera.y - dy * unit });
    }
  };
  const doubleClick = (event: MouseEvent) => {
    if (editable(event.target) || interactive(event.target)) return;
    event.preventDefault();
    zoom(event.shiftKey ? 1 / 1.5 : 1.5, local({ x: event.clientX, y: event.clientY }));
  };
  const key = (event: KeyboardEvent) => {
    if (event.target !== element || event.ctrlKey || event.metaKey || event.altKey) return;
    const offsets: Record<string, Point> = { ArrowLeft: { x: 60, y: 0 }, ArrowRight: { x: -60, y: 0 }, ArrowUp: { x: 0, y: 60 }, ArrowDown: { x: 0, y: -60 } };
    if (["+", "=", "-", "0", "Home", ...Object.keys(offsets)].includes(event.key)) event.preventDefault();
    if (event.key === "+" || event.key === "=") zoom(1.25);
    else if (event.key === "-") zoom(1 / 1.25);
    else if (event.key === "0" || event.key === "Home") { cancelGesture(); animateTo(INITIAL); }
    else if (offsets[event.key]) { cancelGesture(); update({ ...camera, x: camera.x + offsets[event.key].x, y: camera.y + offsets[event.key].y }); }
  };
  const visibility = () => { if (document.hidden) cancelGesture(); };
  const preventDrag = (event: DragEvent) => event.preventDefault();

  return {
    getScale: () => camera.scale,
    getCamera: () => camera,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    zoomIn: () => zoom(1.25),
    zoomOut: () => zoom(1 / 1.25),
    reset: () => { cancelGesture(); animateTo(INITIAL); },
    attach: (surface: HTMLDivElement) => {
      detach?.();
      element = surface;
      paint();
      const options: AddEventListenerOptions = { capture: true, passive: false };
      surface.addEventListener("pointerdown", down, options);
      surface.addEventListener("pointermove", move, options);
      surface.addEventListener("pointerup", end, options);
      surface.addEventListener("pointercancel", end, options);
      surface.addEventListener("lostpointercapture", end, options);
      surface.addEventListener("click", click, true);
      surface.addEventListener("wheel", wheel, options);
      surface.addEventListener("dblclick", doubleClick, options);
      surface.addEventListener("keydown", key);
      surface.addEventListener("dragstart", preventDrag);
      window.addEventListener("blur", cancelGesture);
      document.addEventListener("visibilitychange", visibility);
      const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { cancelGesture(); }) : null;
      resize?.observe(surface);
      detach = () => {
        cancelGesture();
        cancelAnimationFrame(frame); frame = 0;
        surface.removeEventListener("pointerdown", down, true);
        surface.removeEventListener("pointermove", move, true);
        surface.removeEventListener("pointerup", end, true);
        surface.removeEventListener("pointercancel", end, true);
        surface.removeEventListener("lostpointercapture", end, true);
        surface.removeEventListener("click", click, true);
        surface.removeEventListener("wheel", wheel, true);
        surface.removeEventListener("dblclick", doubleClick, true);
        surface.removeEventListener("keydown", key);
        surface.removeEventListener("dragstart", preventDrag);
        window.removeEventListener("blur", cancelGesture);
        document.removeEventListener("visibilitychange", visibility);
        resize?.disconnect();
        element = null;
        detach = undefined;
      };
      return detach;
    },
  };
}

export type TreeViewport = ReturnType<typeof createTreeViewport>;
