"use client";
/* eslint-disable react-hooks/refs, react-hooks/preserve-manual-memoization */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getProvisionalConnectionPath, type ConnectionConfirmState, type ConnectionModeState, type LinePosition, type WorkSchedulePredecessorRelation } from "./use-gantt-connection-mode";

export type GanttConnectionOverlayProps = {
  connectionState: ConnectionModeState | null;
  confirmingState: ConnectionConfirmState | null;
  linePositions: LinePosition[];
  timelineContentWidth: number;
  totalHeight: number;
  onPointerMove: (pointerX: number, pointerY: number) => void;
  onEndConnection: () => void;
  onConfirmConnection: (relation: WorkSchedulePredecessorRelation, lagDays: number) => void;
  onCancelConfirmConnection: () => void;
  onCancelConnection: () => void;
};

const RELATIONS: WorkSchedulePredecessorRelation[] = ["FS", "SS", "FF", "SF"];

function ConnectionConfirmPopover({
  state,
  onConfirm,
  onCancel,
}: {
  state: ConnectionConfirmState;
  onConfirm: (relation: WorkSchedulePredecessorRelation, lagDays: number) => void;
  onCancel: () => void;
}) {
  const [relation, setRelation] = useState<WorkSchedulePredecessorRelation>("FS");
  const [lagDays, setLagDays] = useState("0");

  return (
    <div
      className="absolute z-50 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
      style={{
        left: state.popoverX + 16,
        top: state.popoverY - 40,
      }}
      data-testid="connection-confirm-popover"
    >
      <div className="mb-2 text-[11px] font-semibold text-slate-700">
        {state.sourceItemCode} → {state.targetItemCode}
      </div>

      {/* Relation buttons */}
      <div className="mb-2 flex gap-1">
        {RELATIONS.map((relationOption) => (
          <button
            key={relationOption}
            type="button"
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              relation === relationOption
                ? "bg-sky-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            onClick={() => setRelation(relationOption)}
            data-testid={`relation-${relationOption}`}
          >
            {relationOption}
          </button>
        ))}
      </div>

      {/* Lag days */}
      <div className="mb-3 flex items-center gap-1.5">
        <label className="text-[10px] font-medium text-slate-500">Lag</label>
        <input
          type="number"
          className="w-14 rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-800"
          value={lagDays}
          onChange={(event_) => setLagDays(event_.target.value)}
          data-testid="relation-lag-input"
        />
        <span className="text-[10px] text-slate-400">días</span>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        <button
          type="button"
          className="flex-1 rounded-md bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-sky-700"
          onClick={() => onConfirm(relation, Number(lagDays) || 0)}
          data-testid="confirm-connection-btn"
        >
          Conectar
        </button>
        <button
          type="button"
          className="rounded-md bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
          onClick={onCancel}
          data-testid="cancel-connection-btn"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export const GanttConnectionOverlay = memo(function GanttConnectionOverlay({
  connectionState,
  confirmingState,
  linePositions,
  timelineContentWidth,
  totalHeight,
  onPointerMove,
  onEndConnection,
  onConfirmConnection,
  onCancelConfirmConnection,
}: GanttConnectionOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const captureIdRef = useRef<number | null>(null);
  const hasPointerMovedRef = useRef(false);

  // Reset the moved flag whenever a new connection session starts (connectionState
  // transitions from null to non-null). This ensures the initial frame detects
  // that pointer coords are still viewport-relative and need adjustment.
  if (!connectionState) {
    hasPointerMovedRef.current = false;
  }

  // Adjust source coordinates from viewport-relative to SVG-local.
  // gantt-bar.tsx passes getBoundingClientRect() coordinates which are viewport-relative,
  // but the SVG overlay uses its own coordinate system. The pointer coordinates are
  // already converted in handlePointerMove, but the source bar positions need adjustment.
  //
  // We use containerRef (a wrapper div) instead of svgRef because:
  // - containerRef is populated on the FIRST render (the div always exists)
  // - svgRef.current is null until the SVG commits, causing one frame of bad coordinates
  // - Both use absolute inset-0 so their bounding rects are identical
  const [svgOffset, setSvgOffset] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      setSvgOffset({ left: rect.left, top: rect.top });
    }
  }, [connectionState]);

  const adjustedConnectionState = useMemo(() => {
    if (!connectionState) return null;
    // On the initial render (before any pointer move), pointerX/pointerY are
    // viewport-relative (set to sourceBarRightX/sourceBarCenterY in startConnection).
    // After the first handlePointerMove, they become SVG-local. We track whether
    // a move happened via hasPointerMovedRef instead of comparing coordinates
    // (coordinate comparison would break if svgOffset happened to be {0,0}).
    const adjustPointer = !hasPointerMovedRef.current;
    return {
      ...connectionState,
      sourceBarRightX: connectionState.sourceBarRightX - svgOffset.left,
      sourceBarCenterY: connectionState.sourceBarCenterY - svgOffset.top,
      pointerX: adjustPointer
        ? connectionState.pointerX - svgOffset.left
        : connectionState.pointerX,
      pointerY: adjustPointer
        ? connectionState.pointerY - svgOffset.top
        : connectionState.pointerY,
    };
  }, [connectionState, svgOffset]);

  const adjustedConfirmingState = useMemo(() => {
    if (!confirmingState) return null;
    return {
      ...confirmingState,
      sourceBarRightX: confirmingState.sourceBarRightX - svgOffset.left,
      sourceBarCenterY: confirmingState.sourceBarCenterY - svgOffset.top,
    };
  }, [confirmingState, svgOffset]);

  // Aliases for adjusted state used throughout the component.
  // Declared before hasValidTarget / targetHighlight which reference them.
  const state = adjustedConnectionState;
  const confirmState = adjustedConfirmingState;

  const handlePointerDown = useCallback((event: React.PointerEvent<SVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.setPointerCapture(event.pointerId);
    captureIdRef.current = event.pointerId;
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      // Mark that the pointer has moved at least once. After this point,
      // pointerX/pointerY from updateConnectionPointer are SVG-local and
      // should NOT be adjusted by svgOffset.
      hasPointerMovedRef.current = true;
      const rect = svg.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      onPointerMove(pointerX, pointerY);
    },
    [onPointerMove],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<SVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      try {
        svg.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      captureIdRef.current = null;
      onEndConnection();
    },
    [onEndConnection],
  );

  // Global listener in case pointer is released outside the SVG while captured
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (captureIdRef.current !== null) {
        captureIdRef.current = null;
        onEndConnection();
      }
    };

    document.addEventListener("pointerup", handleGlobalPointerUp);
    return () => document.removeEventListener("pointerup", handleGlobalPointerUp);
  }, [onEndConnection]);

  const hasValidTarget =
    state?.targetItemCode !== null && state?.targetItemCode !== undefined;

  // Target bar highlight
  const targetHighlight = useMemo(() => {
    if (!state?.targetItemCode || !hasValidTarget) return null;
    const target = linePositions.find((pos) => pos.itemCode === state.targetItemCode);
    if (!target) return null;
    return (
      <rect
        x={0}
        y={target.top}
        width={timelineContentWidth}
        height={target.height}
        className="fill-sky-100/40"
        rx={4}
      />
    );
  }, [state?.targetItemCode, hasValidTarget, linePositions, timelineContentWidth]);

  if (!connectionState && !confirmingState) return null;

  return (
    <div ref={containerRef} className="absolute inset-0">
      {/* Confirming popover (rendered as HTML overlay, not SVG) */}
      {confirmingState && (
        <ConnectionConfirmPopover
          state={confirmingState}
          onConfirm={onConfirmConnection}
          onCancel={onCancelConfirmConnection}
        />
      )}

      {state && (
        <svg
          ref={svgRef}
          className="pointer-events-auto absolute inset-0 z-30 cursor-crosshair"
          style={{ width: timelineContentWidth, height: totalHeight }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          data-testid="gantt-connection-overlay"
        >
          {/* Target highlight */}
          {targetHighlight}

          {/* Provisional connector line */}
          <path
            d={getProvisionalConnectionPath(state)}
            fill="none"
            stroke="#2563EB"
            strokeWidth={1.5}
            strokeDasharray="5,3"
            className="opacity-80"
          />

          {/* Source dot */}
          <circle
            cx={state.sourceBarRightX}
            cy={state.sourceBarCenterY}
            r={4}
            className="fill-blue-600"
          />

          {/* Pointer dot */}
          <circle
            cx={state.pointerX}
            cy={state.pointerY}
            r={hasValidTarget ? 4 : 3}
            className={hasValidTarget ? "fill-emerald-500" : "fill-slate-400"}
          />

          {/* Target indicator */}
          {state.targetItemCode && (
            <text
              x={state.pointerX + 10}
              y={state.pointerY - 8}
              className="fill-slate-800 text-[11px] font-semibold"
              style={{ dominantBaseline: "middle" }}
            >
              {state.targetItemCode}
            </text>
          )}
        </svg>
      )}

      {/* When confirming, also show a static version of the connector line */}
      {confirmState && (
        <svg
          className="pointer-events-none absolute inset-0 z-20 overflow-visible"
          style={{ width: timelineContentWidth, height: totalHeight }}
        >
          <line
            x1={confirmState.sourceBarRightX}
            y1={confirmState.sourceBarCenterY}
            x2={confirmState.popoverX}
            y2={confirmState.popoverY}
            stroke="#2563EB"
            strokeWidth={1.5}
            strokeDasharray="5,3"
            className="opacity-80"
          />
          <circle
            cx={confirmState.sourceBarRightX}
            cy={confirmState.sourceBarCenterY}
            r={4}
            className="fill-blue-600"
          />
          <circle
            cx={confirmState.popoverX}
            cy={confirmState.popoverY}
            r={4}
            className="fill-emerald-500"
          />
        </svg>
      )}
    </div>
  );
});
