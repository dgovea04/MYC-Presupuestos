"use client";

import { useCallback, useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL = 15_000;

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

  const sendHeartbeat = useCallback(async () => {
    try {
      await fetch(`/api/budgets/${budgetId}/collaboration/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route, module, status: "ACTIVE" }),
      });
    } catch {
      // heartbeat failures are non-critical
    }
  }, [budgetId, route, module]);

  const removePresence = useCallback(async () => {
    try {
      await fetch(`/api/budgets/${budgetId}/collaboration/presence`, {
        method: "DELETE",
      });
    } catch {
      // cleanup failures are non-critical
    }
  }, [budgetId]);

  useEffect(() => {
    if (!budgetId) return;

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
        fetch(`/api/budgets/${budgetId}/collaboration/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ route, module, status: "IDLE" }),
        }).catch(() => {});
      } else {
        sendHeartbeat();
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

      removePresence();
    };
  }, [sendHeartbeat, removePresence, budgetId, route, module]);

  return { sendHeartbeat };
}
