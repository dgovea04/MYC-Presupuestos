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
  onEventRef.current = onEvent;
  const abortRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    fetch(`/api/budgets/${budgetId}/collaboration/stream`, {
      signal: controller.signal,
      headers: { Accept: "text/event-stream" },
    })
      .then((response) => {
        if (!response.ok || !response.body) {
          throw new Error("Stream connection failed");
        }

        setConnected(true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        function processChunk({ done, value }: ReadableStreamReadResult<Uint8Array>) {
          if (done) {
            setConnected(false);
            scheduleReconnect();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let currentEventType = "";
          let currentData = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              currentData = line.slice(6);
            } else if (line === "" && currentData) {
              try {
                const parsed = JSON.parse(currentData) as CollaborationStreamEvent;
                if (parsed.type !== "ping") {
                  onEventRef.current?.(parsed);
                }
              } catch {
                // skip unparseable events
              }
              currentEventType = "";
              currentData = "";
            }
          }

          reader.read().then(processChunk).catch(() => {
            setConnected(false);
            scheduleReconnect();
          });
        }

        reader.read().then(processChunk).catch(() => {
          setConnected(false);
          scheduleReconnect();
        });
      })
      .catch(() => {
        setConnected(false);
        scheduleReconnect();
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetId, reconnectInterval]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectTimeoutRef.current = window.setTimeout(connect, reconnectInterval);
  }, [connect, reconnectInterval]);

  useEffect(() => {
    connect();

    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return { connected };
}
