"use client";

import { useCallback, useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL = 15_000;
const TERMINAL_COLLABORATION_STATUSES = new Set([401, 403, 404]);
const MIN_HEARTBEAT_GAP_MS = 2_000;
const lastHeartbeatByKey = new Map<string, number>();

export function resetBudgetPresenceHeartbeatDedupeForTests() {
  lastHeartbeatByKey.clear();
}

interface UseBudgetPresenceHeartbeatOptions {
  budgetId: string;
  route: string;
  module: string;
}

export function useBudgetPresenceHeartbeat({
  budgetId,
  route,
  module,
}: UseBudgetPresenceHeartbeatOptions) {
  const intervalRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);
  const disabledRef = useRef(false);

  const stopHeartbeat = useCallback(() => {
    isActiveRef.current = false;
    disabledRef.current = true;

    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const sendHeartbeat = useCallback(async (options?: { force?: boolean }) => {
    if (disabledRef.current) return;

    const heartbeatKey = `${budgetId}:${route}:${module}:ACTIVE`;
    const now = Date.now();
    const lastHeartbeatAt = lastHeartbeatByKey.get(heartbeatKey);
    if (!options?.force && lastHeartbeatAt !== undefined && now - lastHeartbeatAt < MIN_HEARTBEAT_GAP_MS) {
      return;
    }
    lastHeartbeatByKey.set(heartbeatKey, now);

    try {
      const response = await fetch(`/api/budgets/${budgetId}/collaboration/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route, module, status: "ACTIVE" }),
      });

      if (TERMINAL_COLLABORATION_STATUSES.has(response.status)) {
        stopHeartbeat();
      }
    } catch {
      // heartbeat failures are non-critical
    }
  }, [budgetId, route, module, stopHeartbeat]);

  useEffect(() => {
    if (!budgetId) return;

    disabledRef.current = false;
    isActiveRef.current = true;

    // Send initial heartbeat
    sendHeartbeat();

    // Set up interval
    intervalRef.current = window.setInterval(() => {
      if (isActiveRef.current) {
        sendHeartbeat();
      }
    }, HEARTBEAT_INTERVAL);

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        const heartbeatKey = `${budgetId}:${route}:${module}:ACTIVE`;
        lastHeartbeatByKey.delete(heartbeatKey);
        fetch(`/api/budgets/${budgetId}/collaboration/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ route, module, status: "IDLE" }),
        })
          .then((response) => {
            if (TERMINAL_COLLABORATION_STATUSES.has(response.status)) {
              stopHeartbeat();
            }
          })
          .catch(() => {});
      } else {
        sendHeartbeat({ force: true });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Handle page unload - presence expires naturally, no need for explicit cleanup
    // sendBeacon cannot send DELETE method, so we rely on expiration (30s buffer)

    return () => {
      isActiveRef.current = false;

      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [sendHeartbeat, budgetId, route, module, stopHeartbeat]);

  return { sendHeartbeat: () => sendHeartbeat({ force: true }) };
}
