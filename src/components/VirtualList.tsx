import { ReactNode, useMemo, useState } from "react";

type VirtualListProps<T> = {
  items: T[];
  itemHeight: number;
  height?: number;
  overscan?: number;
  className?: string;
  renderItem: (item: T, index: number) => ReactNode;
};

export default function VirtualList<T>({
  items,
  itemHeight,
  height = 680,
  overscan = 8,
  className,
  renderItem,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const safeHeight = Math.max(220, height);
  const totalHeight = items.length * itemHeight;

  const { start, end, offsetY } = useMemo(() => {
    const first = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(safeHeight / itemHeight) + overscan * 2;
    const last = Math.min(items.length, first + visibleCount);
    return { start: first, end: last, offsetY: first * itemHeight };
  }, [items.length, itemHeight, overscan, safeHeight, scrollTop]);

  const visible = items.slice(start, end);

  return (
    <div
      className={className}
      style={{ height: safeHeight, overflowY: "auto", contain: "strict" }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offsetY}px)` }} className="grid gap-2">
          {visible.map((item, localIndex) => renderItem(item, start + localIndex))}
        </div>
      </div>
    </div>
  );
}
