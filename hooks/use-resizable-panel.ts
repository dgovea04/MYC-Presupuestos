"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PanelSize = { width: number; height: number };

const MIN_W = 320;
const MAX_W = 800;
const MIN_H = 280;
const MAX_H = 700;

const DEFAULT_SIZE: PanelSize = { width: 600, height: 500 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function readPanelSize(storageKey: string): PanelSize {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_SIZE;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "width" in parsed &&
      "height" in parsed &&
      typeof (parsed as PanelSize).width === "number" &&
      typeof (parsed as PanelSize).height === "number"
    ) {
      return {
        width: clamp((parsed as PanelSize).width, MIN_W, MAX_W),
        height: clamp((parsed as PanelSize).height, MIN_H, MAX_H),
      };
    }
  } catch {
    // corrupted — fall through
  }
  return DEFAULT_SIZE;
}

type DragOrigin = { x: number; y: number; w: number; h: number };

/**
 * Resizable panel hook — returns current size and a mousedown handler
 * for a resize grip. Persists the final size to localStorage when the
 * user finishes dragging.
 */
export function useResizablePanel(storageKey: string) {
  const [size, setSize] = useState<PanelSize>(() => readPanelSize(storageKey));
  const dragRef = useRef<DragOrigin | null>(null);

  const persist = useCallback(
    (s: PanelSize) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(s));
      } catch {
        // storage full or unavailable — best effort
      }
    },
    [storageKey],
  );

  const onResizeStart = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      event.preventDefault();
      const point = "touches" in event ? event.touches[0] : event;
      if (!point) return;
      dragRef.current = {
        x: point.clientX,
        y: point.clientY,
        w: size.width,
        h: size.height,
      };

      // Lock cursor and prevent text selection during drag
      document.body.style.cursor = "nwse-resize";
      document.body.style.userSelect = "none";
    },
    [size],
  );

  useEffect(() => {
    const onPointerMove = (event: MouseEvent | TouchEvent) => {
      const origin = dragRef.current;
      if (!origin) return;

      const point = "touches" in event ? event.touches[0] : event;
      if (!point) return;

      setSize({
        width: clamp(origin.w + origin.x - point.clientX, MIN_W, MAX_W),
        height: clamp(origin.h + origin.y - point.clientY, MIN_H, MAX_H),
      });
    };

    const onPointerUp = () => {
      // Restore styles even if drag was already cleaned up by a competing event
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (!dragRef.current) return;
      dragRef.current = null;

      // functional updater to read latest state without stale closure
      setSize((current) => {
        persist(current);
        return current;
      });
    };

    document.addEventListener("mousemove", onPointerMove as (e: Event) => void);
    document.addEventListener("mouseup", onPointerUp);
    document.addEventListener("touchmove", onPointerMove as (e: Event) => void);
    document.addEventListener("touchend", onPointerUp);
    return () => {
      document.removeEventListener("mousemove", onPointerMove as (e: Event) => void);
      document.removeEventListener("mouseup", onPointerUp);
      document.removeEventListener("touchmove", onPointerMove as (e: Event) => void);
      document.removeEventListener("touchend", onPointerUp);
      // Clean up styles in case of unexpected unmount during drag
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [persist]);

  return { size, onResizeStart };
}
