"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ConnectionModeState = {
  sourceItemCode: string;
  sourceBudgetItemId: string;
  /** X position of the source bar's right edge relative to the overlay SVG */
  sourceBarRightX: number;
  /** Y position of the source bar center relative to the overlay SVG */
  sourceBarCenterY: number;
  /** Current pointer X relative to the overlay */
  pointerX: number;
  /** Current pointer Y relative to the overlay */
  pointerY: number;
  /** Target item code (detected via hit-testing while dragging) */
  targetItemCode: string | null;
  /** Target budget item id (detected via hit-testing while dragging) */
  targetBudgetItemId: string | null;
};

/** State shown after the user releases the pointer with a valid target */
export type ConnectionConfirmState = {
  sourceItemCode: string;
  sourceBudgetItemId: string;
  targetItemCode: string;
  targetBudgetItemId: string;
  sourceBarRightX: number;
  sourceBarCenterY: number;
  /** Where to render the selector popover */
  popoverX: number;
  popoverY: number;
};

import type { WorkSchedulePredecessorRelation } from "@/lib/work-schedule/predecessors";
export type { WorkSchedulePredecessorRelation };

type ConnectionSession = {
  sourceItemCode: string;
  sourceBudgetItemId: string;
  sourceBarRightX: number;
  sourceBarCenterY: number;
};

export type LinePosition = {
  budgetItemId: string;
  itemCode: string;
  top: number;
  height: number;
};

/** Compute the SVG `d` path for the provisional connector line (pure function) */
export function getProvisionalConnectionPath(state: ConnectionModeState): string {
  const { sourceBarRightX, sourceBarCenterY, pointerX, pointerY } = state;
  const elbowOffset = 8;
  const sourceExitOffset = 12;
  const sourceX = sourceBarRightX + sourceExitOffset;
  const midX = Math.max(sourceX + elbowOffset, pointerX - elbowOffset);

  if (pointerX <= sourceX + elbowOffset * 2) {
    return `M ${sourceBarRightX} ${sourceBarCenterY} L ${sourceX} ${sourceBarCenterY} L ${pointerX} ${pointerY}`;
  }

  return [
    `M ${sourceBarRightX} ${sourceBarCenterY}`,
    `L ${sourceX} ${sourceBarCenterY}`,
    `L ${midX} ${sourceBarCenterY}`,
    `L ${midX} ${pointerY}`,
    `L ${pointerX} ${pointerY}`,
  ].join(" ");
}

export function useGanttConnectionMode({
  linePositions,
  onConnect,
}: {
  linePositions: LinePosition[];
  onConnect: (sourceItemCode: string, targetItemCode: string, relation: WorkSchedulePredecessorRelation, lagDays: number) => void;
}) {
  const [connectionState, setConnectionState] = useState<ConnectionModeState | null>(null);
  const [confirmingState, setConfirmingState] = useState<ConnectionConfirmState | null>(null);
  const sessionRef = useRef<ConnectionSession | null>(null);
  const latestStateRef = useRef<ConnectionModeState | null>(null);
  const onConnectRef = useRef(onConnect);

  useEffect(() => {
    onConnectRef.current = onConnect;
  }, [onConnect]);

  const startConnection = useCallback(
    (
      sourceItemCode: string,
      sourceBudgetItemId: string,
      sourceBarRightX: number,
      sourceBarCenterY: number,
    ) => {
      const session: ConnectionSession = {
        sourceItemCode,
        sourceBudgetItemId,
        sourceBarRightX,
        sourceBarCenterY,
      };

      sessionRef.current = session;

      const initialState: ConnectionModeState = {
        sourceItemCode,
        sourceBudgetItemId,
        sourceBarRightX,
        sourceBarCenterY,
        pointerX: sourceBarRightX,
        pointerY: sourceBarCenterY,
        targetItemCode: null,
        targetBudgetItemId: null,
      };

      latestStateRef.current = initialState;
      setConnectionState(initialState);
    },
    [],
  );

  const updateConnectionPointer = useCallback(
    (pointerX: number, pointerY: number) => {
      const session = sessionRef.current;
      if (!session) return;

      const target = hitTestLinePosition(pointerY, linePositions, session.sourceItemCode);

      const nextState: ConnectionModeState = {
        sourceItemCode: session.sourceItemCode,
        sourceBudgetItemId: session.sourceBudgetItemId,
        sourceBarRightX: session.sourceBarRightX,
        sourceBarCenterY: session.sourceBarCenterY,
        pointerX,
        pointerY,
        targetItemCode: target?.itemCode ?? null,
        targetBudgetItemId: target?.budgetItemId ?? null,
      };

      latestStateRef.current = nextState;
      setConnectionState(nextState);
    },
    [linePositions],
  );

  const endConnection = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;

    const latestState = latestStateRef.current;

    sessionRef.current = null;
    latestStateRef.current = null;
    setConnectionState(null);

    // If we have a valid target, transition to confirming instead of calling onConnect immediately
    if (latestState?.targetItemCode && latestState.targetBudgetItemId) {
      setConfirmingState({
        sourceItemCode: session.sourceItemCode,
        sourceBudgetItemId: session.sourceBudgetItemId,
        targetItemCode: latestState.targetItemCode,
        targetBudgetItemId: latestState.targetBudgetItemId,
        sourceBarRightX: session.sourceBarRightX,
        sourceBarCenterY: session.sourceBarCenterY,
        popoverX: latestState.pointerX,
        popoverY: latestState.pointerY,
      });
    }
  }, []);

  const confirmConnection = useCallback((relation: WorkSchedulePredecessorRelation, lagDays: number) => {
    const state = confirmingState;
    if (!state) return;
    setConfirmingState(null);
    onConnectRef.current(state.sourceItemCode, state.targetItemCode, relation, lagDays);
  }, [confirmingState]);

  const cancelConfirmConnection = useCallback(() => {
    setConfirmingState(null);
  }, []);

  const cancelConnection = useCallback(() => {
    sessionRef.current = null;
    latestStateRef.current = null;
    setConnectionState(null);
    setConfirmingState(null);
  }, []);

  const isActive = connectionState !== null;

  return {
    connectionState,
    confirmingState,
    isActive,
    startConnection,
    updateConnectionPointer,
    endConnection,
    confirmConnection,
    cancelConfirmConnection,
    cancelConnection,
  };
}

function hitTestLinePosition(
  pointerY: number,
  linePositions: LinePosition[],
  sourceItemCode: string,
): LinePosition | null {
  for (const position of linePositions) {
    if (position.itemCode === sourceItemCode) continue;
    const bottom = position.top + position.height;
    if (pointerY >= position.top && pointerY <= bottom) {
      return position;
    }
  }
  return null;
}
