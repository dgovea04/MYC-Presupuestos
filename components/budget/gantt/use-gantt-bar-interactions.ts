import { useCallback, useRef, useState } from "react";

export type GanttInteractionMode = "idle" | "dragging" | "resizing-left" | "resizing-right";

export type GanttInteractionState = {
  mode: GanttInteractionMode;
  deltaPx: number;
  tooltipLabel: string;
  isValid: boolean;
};

const MIN_DRAG_THRESHOLD_PX = 3;

export function useGanttBarInteractions({
  onDragChange,
  onResizeLeftChange,
  onResizeRightChange,
  onDragEnd,
  onResizeEnd,
  getTooltipLabel,
}: {
  onDragChange: (deltaPx: number) => { isValid: boolean; label: string };
  onResizeLeftChange: (deltaPx: number) => { isValid: boolean; label: string };
  onResizeRightChange: (deltaPx: number) => { isValid: boolean; label: string };
  onDragEnd: (deltaPx: number) => void;
  onResizeEnd: (deltaPx: number, mode: "resizing-left" | "resizing-right") => void;
  getTooltipLabel: (deltaPx: number, mode: GanttInteractionMode) => string;
}) {
  const [state, setState] = useState<GanttInteractionState>({
    mode: "idle",
    deltaPx: 0,
    tooltipLabel: "",
    isValid: true,
  });

  const sessionRef = useRef<{
    mode: GanttInteractionMode;
    startX: number;
    startY: number;
    hasMoved: boolean;
    originalDeltaPx: number;
  } | null>(null);

  const updateStateFromDelta = useCallback(
    (deltaPx: number, mode: GanttInteractionMode) => {
      let result: { isValid: boolean; label: string };
      if (mode === "dragging") {
        result = onDragChange(deltaPx);
      } else if (mode === "resizing-left") {
        result = onResizeLeftChange(deltaPx);
      } else {
        result = onResizeRightChange(deltaPx);
      }

      setState({
        mode,
        deltaPx,
        tooltipLabel: result.label || getTooltipLabel(deltaPx, mode),
        isValid: result.isValid,
      });
    },
    [onDragChange, onResizeLeftChange, onResizeRightChange, getTooltipLabel],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent, mode: GanttInteractionMode) => {
      if (mode === "idle") return;

      event.preventDefault();
      event.stopPropagation();
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);

      sessionRef.current = {
        mode,
        startX: event.clientX,
        startY: event.clientY,
        hasMoved: false,
        originalDeltaPx: state.deltaPx,
      };

      setState((current) => ({
        ...current,
        mode,
        deltaPx: 0,
        tooltipLabel: getTooltipLabel(0, mode),
        isValid: true,
      }));
    },
    [getTooltipLabel, state.deltaPx],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      const session = sessionRef.current;
      if (!session) return;

      const deltaPx = event.clientX - session.startX;

      if (!session.hasMoved) {
        if (Math.abs(deltaPx) < MIN_DRAG_THRESHOLD_PX && Math.abs(event.clientY - session.startY) < MIN_DRAG_THRESHOLD_PX) {
          return;
        }
        session.hasMoved = true;
      }

      updateStateFromDelta(deltaPx, session.mode);
    },
    [updateStateFromDelta],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent) => {
      const session = sessionRef.current;
      if (!session) return;

      try {
        (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }

      const deltaPx = event.clientX - session.startX;
      sessionRef.current = null;

      if (!session.hasMoved) {
        setState({ mode: "idle", deltaPx: 0, tooltipLabel: "", isValid: true });
        return;
      }

      if (session.mode === "dragging") {
        onDragEnd(deltaPx);
      } else if (session.mode === "resizing-left" || session.mode === "resizing-right") {
        onResizeEnd(deltaPx, session.mode);
      }

      setState({ mode: "idle", deltaPx: 0, tooltipLabel: "", isValid: true });
    },
    [onDragEnd, onResizeEnd],
  );

  const handlePointerLeave = useCallback(
    (event: React.PointerEvent) => {
      if (sessionRef.current) {
        handlePointerUp(event);
      }
    },
    [handlePointerUp],
  );

  return {
    state,
    handleBarPointerDown: useCallback(
      (event: React.PointerEvent) => handlePointerDown(event, "dragging"),
      [handlePointerDown],
    ),
    handleLeftHandlePointerDown: useCallback(
      (event: React.PointerEvent) => handlePointerDown(event, "resizing-left"),
      [handlePointerDown],
    ),
    handleRightHandlePointerDown: useCallback(
      (event: React.PointerEvent) => handlePointerDown(event, "resizing-right"),
      [handlePointerDown],
    ),
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
  };
}
