"use client";

import { useCallback, useRef, useState } from "react";

const HEARTBEAT_INTERVAL = 10_000;

interface UseEditSessionOptions {
  budgetId: string;
}

interface EditSessionInfo {
  sessionId: string;
  entityType: string;
  entityId: string;
  field: string;
}

export function useEditSession({ budgetId }: UseEditSessionOptions) {
  const [activeSession, setActiveSession] = useState<EditSessionInfo | null>(null);
  const heartbeatRef = useRef<number | null>(null);

  const startEditSession = useCallback(
    async (entityType: string, entityId: string, field: string) => {
      // Finish any existing session first
      if (activeSession) {
        try {
          await fetch(
            `/api/budgets/${budgetId}/collaboration/edit-sessions/${activeSession.sessionId}`,
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
    [budgetId, activeSession],
  );

  const finishCurrentSession = useCallback(async () => {
    if (!activeSession) return;

    try {
      await fetch(
        `/api/budgets/${budgetId}/collaboration/edit-sessions/${activeSession.sessionId}`,
        { method: "DELETE" },
      );
    } catch {
      // non-critical
    }

    setActiveSession(null);

    if (heartbeatRef.current) {
      window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, [activeSession, budgetId]);

  return {
    activeSession,
    startEditSession,
    finishCurrentSession,
  };
}
