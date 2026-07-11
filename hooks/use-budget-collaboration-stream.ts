"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CollaborationStreamEvent = {
  type: string;
  budgetId: string;
  timestamp: string;
  payload: unknown;
};

interface UseBudgetCollaborationStreamOptions {
  budgetId: string;
  onEvent?: (event: CollaborationStreamEvent) => void;
  reconnectInterval?: number;
}

export function useBudgetCollaborationStream({
  budgetId,
  onEvent,
  reconnectInterval = 3000,
}: UseBudgetCollaborationStreamOptions) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  const abortRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const connectRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const clearReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    clearReconnect();
    reconnectTimeoutRef.current = window.setTimeout(() => {
      connectRef.current?.();
    }, reconnectInterval);
  }, [clearReconnect, reconnectInterval]);

  const handleDisconnect = useCallback(
    (controller: AbortController) => {
      if (controller.signal.aborted || !mountedRef.current) return;
      setConnected(false);
      scheduleReconnect();
    },
    [scheduleReconnect],
  );

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    clearReconnect();

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    fetch(`/api/budgets/${budgetId}/collaboration/stream`, {
      signal: controller.signal,
      headers: { Accept: "text/event-stream" },
    })
      .then(async (response) => {
        if (controller.signal.aborted || !mountedRef.current) return;

        if (!response.ok || !response.body) {
          throw new Error("Stream connection failed");
        }

        setConnected(true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let currentData = "";

        try {
          while (mountedRef.current && !controller.signal.aborted) {
            const { done, value } = await reader.read();
            if (done) {
              handleDisconnect(controller);
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const rawLine of lines) {
              const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
              if (line.startsWith("data: ")) {
                currentData += line.slice(6);
              } else if (line === "" && currentData) {
                try {
                  const parsed = JSON.parse(currentData) as CollaborationStreamEvent;
                  if (parsed.type !== "ping") {
                    onEventRef.current?.(parsed);
                  }
                } catch {
                  // skip unparseable events
                }
                currentData = "";
              }
            }
          }
        } catch {
          handleDisconnect(controller);
        } finally {
          reader.releaseLock();
        }
      })
      .catch(() => {
        handleDisconnect(controller);
      });
  }, [budgetId, clearReconnect, handleDisconnect]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      clearReconnect();
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [clearReconnect, connect]);

  return { connected };
}
