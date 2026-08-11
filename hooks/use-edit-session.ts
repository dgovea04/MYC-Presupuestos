"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const HEARTBEAT_INTERVAL = 10_000;

interface UseEditSessionOptions {
  budgetId: string;
  enabled?: boolean;
}

interface EditSessionInfo {
  sessionId: string;
  entityType: string;
  entityId: string;
  field: string;
}

export function useEditSession({ budgetId, enabled = true }: UseEditSessionOptions) {
  const [activeSession, setActiveSession] = useState<EditSessionInfo | null>(null);
  const activeSessionRef = useRef<EditSessionInfo | null>(null);
  const heartbeatRef = useRef<number | null>(null);

  const startEditSession = useCallback(
    async (entityType: string, entityId: string, field: string) => {
      if (!enabled || !budgetId) return;

      // Finish any existing session first (read from ref to avoid stale closure)
      const currentSession = activeSessionRef.current;
      if (currentSession) {
        try {
          await fetch(
            `/api/budgets/${budgetId}/collaboration/edit-sessions/${currentSession.sessionId}`,
            { method: "DELETE" },
          );
        } catch {
          // non-critical
        }
      }

      try {
        const response = await fetch(
          `/api/budgets/${budgetId}/collaboration/edit-sessions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entityType, entityId, field }),
          },
        );

        if (!response.ok) return;

        const data = (await response.json()) as {
          editSession: { id: string };
        };

        const sessionInfo: EditSessionInfo = {
          sessionId: data.editSession.id,
          entityType,
          entityId,
          field,
        };

        setActiveSession(sessionInfo);
        activeSessionRef.current = sessionInfo;

        // Start heartbeat
        if (heartbeatRef.current) {
          window.clearInterval(heartbeatRef.current);
        }

        heartbeatRef.current = window.setInterval(() => {
          fetch(
            `/api/budgets/${budgetId}/collaboration/edit-sessions/${sessionInfo.sessionId}`,
            { method: "PATCH" },
          ).catch(() => {});
        }, HEARTBEAT_INTERVAL);
      } catch {
        // non-critical
      }
    },
    [budgetId, enabled],
  );

  const finishCurrentSession = useCallback(async () => {
    // Read from ref to avoid stale closure — always sees the latest session
    const currentSession = activeSessionRef.current;
    if (!currentSession) return;

    try {
      await fetch(
        `/api/budgets/${budgetId}/collaboration/edit-sessions/${currentSession.sessionId}`,
        { method: "DELETE" },
      );
    } catch {
      // non-critical
    }

    setActiveSession(null);
    activeSessionRef.current = null;

    if (heartbeatRef.current) {
      window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, [budgetId]);

  useEffect(() => {
    if (enabled) return;
    void finishCurrentSession();
  }, [enabled, finishCurrentSession]);

  return {
    activeSession,
    startEditSession,
    finishCurrentSession,
  };
}
