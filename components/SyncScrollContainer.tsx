import React, { useRef, useEffect } from "react";

interface SyncScrollContainerProps {
  children: (
    leftRef: React.RefObject<HTMLDivElement | null>,
    rightRef: React.RefObject<HTMLDivElement | null>,
  ) => React.ReactNode;
}

export const SyncScrollContainer: React.FC<SyncScrollContainerProps> = ({
  children,
}) => {
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    const left = leftRef.current;
    const right = rightRef.current;

    if (!left || !right) return;

    const sync = (source: HTMLDivElement, target: HTMLDivElement) => {
      if (syncingRef.current) return;
      syncingRef.current = true;

      // Synchronize both vertical and horizontal scroll positions
      target.scrollTop = source.scrollTop;
      target.scrollLeft = source.scrollLeft;

      window.requestAnimationFrame(() => {
        syncingRef.current = false;
      });
    };

    const handleLeftScroll = () => sync(left, right);
    const handleRightScroll = () => sync(right, left);

    left.addEventListener("scroll", handleLeftScroll, { passive: true });
    right.addEventListener("scroll", handleRightScroll, { passive: true });

    return () => {
      left.removeEventListener("scroll", handleLeftScroll);
      right.removeEventListener("scroll", handleRightScroll);
    };
  }, []);

  return <>{children(leftRef, rightRef)}</>;
};
