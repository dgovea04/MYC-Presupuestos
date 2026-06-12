"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Generic undo/redo hook that tracks a history stack of states.
 *
 * - `setState` pushes the previous state to the undo stack.
 * - `undo` / `redo` traverse the history.
 * - `reset` erases the entire history and sets a new baseline.
 * - `canUndo` / `canRedo` are reactive booleans.
 */
export function useUndoRedo<T>(
  initial: T,
  options?: { maxHistory?: number },
) {
  const maxHistory = options?.maxHistory ?? 50;

  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);
  const [present, setPresent] = useState<T>(initial);
  const [, bump] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const setState = useCallback(
    (action: React.SetStateAction<T>) => {
      setPresent((current) => {
        const next =
          typeof action === "function"
            ? (action as (prev: T) => T)(current)
            : action;

        if (Object.is(next, current)) return current;

        pastRef.current = [...pastRef.current, current];
        if (pastRef.current.length > maxHistory) {
          pastRef.current = pastRef.current.slice(-maxHistory);
        }
        futureRef.current = [];
        setCanUndo(true);
        setCanRedo(false);
        bump((v) => v + 1);

        return next;
      });
    },
    [maxHistory],
  );

  const undo = useCallback(() => {
    setPresent((current) => {
      const past = pastRef.current;
      if (past.length === 0) return current;

      const previous = past[past.length - 1]!;
      pastRef.current = past.slice(0, -1);
      futureRef.current = [...futureRef.current, current];
      setCanUndo(pastRef.current.length > 0);
      setCanRedo(true);
      bump((v) => v + 1);

      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    setPresent((current) => {
      const future = futureRef.current;
      if (future.length === 0) return current;

      const next = future[future.length - 1]!;
      futureRef.current = future.slice(0, -1);
      pastRef.current = [...pastRef.current, current];
      setCanUndo(true);
      setCanRedo(futureRef.current.length > 0);
      bump((v) => v + 1);

      return next;
    });
  }, []);

  const reset = useCallback((state: T) => {
    pastRef.current = [];
    futureRef.current = [];
    setPresent(state);
    setCanUndo(false);
    setCanRedo(false);
    bump((v) => v + 1);
  }, []);

  const clearHistory = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
    bump((v) => v + 1);
  }, []);

  return {
    state: present,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    clearHistory,
  };
}
