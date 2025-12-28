import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, memo, ReactNode, CSSProperties } from "react";

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  estimateSize?: number;
  overscan?: number;
  className?: string;
  itemClassName?: string;
  getItemKey?: (item: T, index: number) => string | number;
  horizontal?: boolean;
}

function VirtualizedListInner<T>({
  items,
  renderItem,
  estimateSize = 60,
  overscan = 5,
  className = "",
  itemClassName = "",
  getItemKey,
  horizontal = false,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    horizontal,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ contain: "strict" }}
    >
      <div
        style={{
          height: horizontal ? "100%" : `${virtualizer.getTotalSize()}px`,
          width: horizontal ? `${virtualizer.getTotalSize()}px` : "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          const key = getItemKey
            ? getItemKey(item, virtualItem.index)
            : virtualItem.key;

          const style: CSSProperties = horizontal
            ? {
                position: "absolute",
                top: 0,
                left: 0,
                height: "100%",
                width: `${virtualItem.size}px`,
                transform: `translateX(${virtualItem.start}px)`,
              }
            : {
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              };

          return (
            <div key={key} style={style} className={itemClassName}>
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Memoize the component
const VirtualizedList = memo(VirtualizedListInner) as typeof VirtualizedListInner;

export default VirtualizedList;
