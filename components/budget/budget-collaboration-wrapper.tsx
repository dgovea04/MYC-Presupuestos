"use client";

import { memo, useCallback, useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { BudgetCollaborationBar } from "@/components/budget/budget-collaboration-bar";
import { BudgetCommentsSheet } from "@/components/budget/budget-comments-sheet";
import { BudgetChangeHistorySheet } from "@/components/budget/budget-change-history-sheet";
import { BudgetVersionHistorySheet } from "@/components/budget/budget-version-history-sheet";
import { useBudgetPresenceHeartbeat } from "@/hooks/use-budget-presence-heartbeat";
import { useBudgetCollaborationStream, type CollaborationStreamEvent } from "@/hooks/use-budget-collaboration-stream";
import type { CollaborationPresenceRecord } from "@/types/collaboration";

type SheetKind = "comments" | "history" | "versions" | null;
const INITIAL_PRESENCE_FETCH_DELAY_MS = 2_500;

interface BudgetCollaborationWrapperProps {
  budgetId: string;
  projectId: string;
  budgetName: string;
  userId: string;
  children: React.ReactNode;
}

export const BudgetCollaborationWrapper = memo(function BudgetCollaborationWrapper({
  budgetId,
  projectId,
  budgetName,
  userId,
  children,
}: BudgetCollaborationWrapperProps) {
  const [activeSheet, setActiveSheet] = useState<SheetKind>(null);
  const [presence, setPresence] = useState<CollaborationPresenceRecord[]>([]);
  const [activeCommentCount] = useState(0);
  const [collaborationAvailable, setCollaborationAvailable] = useState(true);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Presence heartbeat
  useBudgetPresenceHeartbeat({
    budgetId,
    route: typeof window !== "undefined" ? window.location.pathname : `/budgets/${budgetId}`,
    module: "budget",
  });

  // Collaboration stream
  const fetchPresence = useCallback(async () => {
    if (!collaborationAvailable) return;

    try {
      const response = await fetch(`/api/budgets/${budgetId}/collaboration/presence`);
      if ([401, 403, 404].includes(response.status)) {
        setCollaborationAvailable(false);
        setPresence([]);
        return;
      }
      if (!response.ok) return;
      const data = (await response.json()) as { presence: CollaborationPresenceRecord[] };
      setPresence(data.presence);
    } catch {
      // silent
    }
  }, [budgetId, collaborationAvailable]);

  const fetchPresenceRef = useRef(fetchPresence);
  fetchPresenceRef.current = fetchPresence;

  const sessionUserIdRef = useRef(userId);
  sessionUserIdRef.current = userId;

  // Collaboration stream
  const { connected } = useBudgetCollaborationStream({
    budgetId,
    onEvent: useCallback((event: CollaborationStreamEvent) => {
      fetchPresenceRef.current();

      // Show toast when a note is shared with the current user
      if (event.type === "note.shared") {
        const payload = event.payload as {
          noteId: string;
          body: string;
          author: { name: string; avatarUrl: string | null };
          sharedByUserId: string;
          sharedWith: string[];
        } | null;

        if (payload && payload.sharedWith.includes(sessionUserIdRef.current)) {
          toast.info("Te compartieron una nota", {
            description: payload.body.length > 80 ? payload.body.slice(0, 80) + "…" : payload.body,
            duration: 5000,
          });
        }
      }
    }, []),
  });

  useEffect(() => {
    setCollaborationAvailable(true);
  }, [budgetId]);

  useEffect(() => {
    if (!collaborationAvailable) return;

    const timeoutId = window.setTimeout(() => {
      fetchPresenceRef.current();
    }, INITIAL_PRESENCE_FETCH_DELAY_MS);
    const interval = setInterval(() => fetchPresenceRef.current(), 30_000);
    return () => {
      window.clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [budgetId, collaborationAvailable, fetchPresence]);

  const handleSaveVersion = useCallback(async () => {
    try {
      await fetch(`/api/budgets/${budgetId}/collaboration/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: `Snapshot - ${budgetName}`,
          reason: "Version manual",
        }),
      });
      // Refresh versions sheet if open
      if (activeSheet === "versions") {
        setActiveSheet(null);
        setTimeout(() => setActiveSheet("versions"), 100);
      }
    } catch {
      // silent
    }
  }, [budgetId, budgetName, activeSheet]);

  const sheetWidth = activeSheet ? "w-80" : "w-0";

  return (
    <div className="relative flex flex-col gap-3">
      {/* Collaboration bar */}
      <div className="flex items-center justify-end">
        <BudgetCollaborationBar
          budgetId={budgetId}
          projectId={projectId}
          connected={connected}
          presence={presence}
          activeCommentCount={activeCommentCount}
          onOpenComments={() =>
            setActiveSheet((current) => (current === "comments" ? null : "comments"))
          }
          onOpenHistory={() =>
            setActiveSheet((current) => (current === "history" ? null : "history"))
          }
          onOpenVersions={() =>
            setActiveSheet((current) => (current === "versions" ? null : "versions"))
          }
          onSaveVersion={handleSaveVersion}
        />
      </div>

      {/* Main content with optional side sheet */}
      <div className="flex gap-0">
        <div className="min-w-0 flex-1">{children}</div>
        {activeSheet ? (
          <div ref={sheetRef} className={sheetWidth + " shrink-0 overflow-hidden transition-all"}>
            {activeSheet === "comments" ? (
              <BudgetCommentsSheet
                open
                budgetId={budgetId}
                onClose={() => setActiveSheet(null)}
              />
            ) : activeSheet === "history" ? (
              <BudgetChangeHistorySheet
                open
                budgetId={budgetId}
                onClose={() => setActiveSheet(null)}
              />
            ) : activeSheet === "versions" ? (
              <BudgetVersionHistorySheet
                open
                budgetId={budgetId}
                onClose={() => setActiveSheet(null)}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
});
