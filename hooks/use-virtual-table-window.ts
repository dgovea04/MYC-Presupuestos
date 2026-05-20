"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type VirtualTableWindowInput<T> = {
  items: T[];
  rowHeight: number;
  overscan: number;
  fallbackVisibleRows?: number;
  resetKey?: unknown;
};

type VirtualTableWindowResult<T> = {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  scrollProps: {
    onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  };
  virtualRange: {
    topSpacerHeight: number;
    bottomSpacerHeight: number;
    visibleRows: T[];
  };
};

export function useVirtualTableWindow<T>({
  items,
  rowHeight,
  overscan,
  fallbackVisibleRows = 10,
  resetKey,
}: VirtualTableWindowInput<T>): VirtualTableWindowResult<T> {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollFrameRef = useRef<number | null>(null);
  const latestScrollTopRef = useRef(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) return;

    const updateViewportHeight = () => setViewportHeight(element.clientHeight);
    updateViewportHeight();

    const ResizeObserverConstructor = globalThis.ResizeObserver;
    if (!ResizeObserverConstructor) return;

    const observer = new ResizeObserverConstructor(() => updateViewportHeight());
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (pendingScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingScrollFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) return;

    if (typeof element.scrollTo === "function") {
      element.scrollTo({ top: 0 });
    } else {
      element.scrollTop = 0;
    }

    latestScrollTopRef.current = 0;
    if (pendingScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingScrollFrameRef.current);
      pendingScrollFrameRef.current = null;
    }
    setScrollTop(0);
  }, [resetKey]);

  const virtualRange = useMemo(() => {
    if (items.length === 0) {
      return {
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
        visibleRows: [] as T[],
      };
    }

    const estimatedViewportHeight = viewportHeight || rowHeight * fallbackVisibleRows;
    const visibleCount = Math.max(1, Math.ceil(estimatedViewportHeight / rowHeight));
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);
    const topSpacerHeight = startIndex * rowHeight;
    const bottomSpacerHeight = Math.max(0, (items.length - endIndex) * rowHeight);

    return {
      topSpacerHeight,
      bottomSpacerHeight,
      visibleRows: items.slice(startIndex, endIndex),
    };
  }, [fallbackVisibleRows, items, overscan, rowHeight, scrollTop, viewportHeight]);

  return {
    scrollContainerRef,
    scrollProps: {
      onScroll: (event) => {
        latestScrollTopRef.current = event.currentTarget.scrollTop;

        if (pendingScrollFrameRef.current !== null) {
          return;
        }

        pendingScrollFrameRef.current = window.requestAnimationFrame(() => {
          pendingScrollFrameRef.current = null;
          setScrollTop((current) => (current === latestScrollTopRef.current ? current : latestScrollTopRef.current));
        });
      },
    },
    virtualRange,
  };
}
