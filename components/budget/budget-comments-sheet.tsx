"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, MessageSquareOff, Reply, Send } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { CollaborationCommentRecord } from "@/types/collaboration";

interface BudgetCommentsSheetProps {
  open: boolean;
  budgetId: string;
  entityType?: string;
  entityId?: string;
  onClose: () => void;
}

export const BudgetCommentsSheet = memo(function BudgetCommentsSheet({
  open,
  budgetId,
  entityType,
  entityId,
  onClose,
}: BudgetCommentsSheetProps) {
  const [comments, setComments] = useState<CollaborationCommentRecord[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll detection is handled directly by FloatingAiAssistant
  // via the data-comments-scroll attribute on the list container below

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entityType) params.set("entityType", entityType);
      if (entityId) params.set("entityId", entityId);

      const response = await fetch(
        `/api/budgets/${budgetId}/collaboration/comments?${params.toString()}`,
      );
      if (!response.ok) throw new Error("Failed to load comments");

      const data = (await response.json()) as {
        comments: CollaborationCommentRecord[];
      };
      setComments(data.comments);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [budgetId, entityType, entityId]);

  useEffect(() => {
    if (open) {
      fetchComments();
    }
  }, [open, fetchComments]);

  const handleSubmit = useCallback(async () => {
    if (!body.trim()) return;

    try {
      const payload: Record<string, unknown> = {
        entityType: entityType ?? "BUDGET",
        entityId: entityId ?? budgetId,
        body: body.trim(),
      };

      if (replyToId) {
        payload.parentCommentId = replyToId;
      }

      const response = await fetch(
        `/api/budgets/${budgetId}/collaboration/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) throw new Error("Failed to create comment");

      setBody("");
      setReplyToId(null);
      await fetchComments();
    } catch {
      // silent
    }
  }, [body, budgetId, entityType, entityId, replyToId, fetchComments]);

  const handleResolve = useCallback(
    async (commentId: string, resolved: boolean) => {
      try {
        await fetch(
          `/api/budgets/${budgetId}/collaboration/comments/${commentId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resolved }),
          },
        );
        await fetchComments();
      } catch {
        // silent
      }
    },
    [budgetId, fetchComments],
  );

  if (!open) return null;

  const topLevelComments = comments.filter((c) => !c.parentCommentId);
  const repliesByParent = new Map<string, CollaborationCommentRecord[]>();
  for (const comment of comments) {
    if (comment.parentCommentId) {
      const list = repliesByParent.get(comment.parentCommentId) ?? [];
      list.push(comment);
      repliesByParent.set(comment.parentCommentId, list);
    }
  }

  return (
    <div className="flex h-full flex-col border-l border-[var(--app-border)] bg-[var(--app-surface)]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--app-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[var(--app-text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--app-text-strong)]">
            Comentarios
          </h3>
          {comments.length > 0 ? (
            <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">
              {comments.length}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-strong)]"
          aria-label="Cerrar comentarios"
        >
          ×
        </button>
      </div>

      {/* Comments list */}
      <div ref={listRef} data-comments-scroll className="flex-1 overflow-auto px-4 py-3">
        {loading ? (
          <p className="py-6 text-center text-xs text-[var(--app-text-muted)]">
            Cargando comentarios...
          </p>
        ) : topLevelComments.length === 0 ? (
          <p className="py-6 text-center text-xs text-[var(--app-text-muted)]">
            Sin comentarios aun
          </p>
        ) : (
          <div className="space-y-3">
            {topLevelComments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                replies={repliesByParent.get(comment.id) ?? []}
                onResolve={handleResolve}
                onReply={(commentId) => setReplyToId(commentId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="relative z-[70] shrink-0 border-t border-[var(--app-border)] bg-[var(--app-surface)] p-3">
        {replyToId ? (
          <div className="mb-2 flex items-center gap-1 text-[11px] text-[var(--app-text-muted)]">
            <Reply className="h-3 w-3" />
            <span>Respondiendo...</span>
            <button
              type="button"
              onClick={() => setReplyToId(null)}
              className="ml-auto rounded px-1 py-0.5 text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]"
            >
              Cancelar
            </button>
          </div>
        ) : null}
        <div className="flex gap-2">
          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="Escribe un comentario..."
            className="flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-elevated)] px-3 py-1.5 text-xs placeholder:text-[var(--app-text-muted)] focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
          />
          <button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={!body.trim()}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-600 text-white transition hover:bg-sky-700 disabled:opacity-40"
            aria-label="Enviar comentario"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});

function CommentThread({
  comment,
  replies,
  onResolve,
  onReply,
}: {
  comment: CollaborationCommentRecord;
  replies: CollaborationCommentRecord[];
  onResolve: (commentId: string, resolved: boolean) => void;
  onReply: (commentId: string) => void;
}) {
  const isResolved = comment.resolvedAt !== null;

  return (
    <div className={cn("rounded-lg border p-3", isResolved ? "border-emerald-200 bg-emerald-50/40" : "border-[var(--app-border)]")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--app-text-strong)]">
              {comment.createdByName}
            </span>
            <span className="text-[10px] text-[var(--app-text-muted)]">
              {formatDate(comment.createdAt)}
            </span>
            {isResolved ? (
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                Resuelto
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--app-text)]">
            {comment.body}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onReply(comment.id)}
            className="rounded p-1 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-strong)]"
            title="Responder"
            aria-label="Responder comentario"
          >
            <Reply className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onResolve(comment.id, !isResolved)}
            className="rounded p-1 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-strong)]"
            title={isResolved ? "Reabrir" : "Resolver"}
            aria-label={isResolved ? "Reabrir comentario" : "Resolver comentario"}
          >
            {isResolved ? (
              <MessageSquareOff className="h-3 w-3" />
            ) : (
              <MessageSquare className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 ? (
        <div className="ml-4 mt-2 space-y-2 border-l-2 border-[var(--app-border-soft)] pl-3">
          {replies.map((reply) => (
            <div key={reply.id} className="text-xs">
              <span className="font-semibold text-[var(--app-text-strong)]">
                {reply.createdByName}
              </span>{" "}
              <span className="text-[10px] text-[var(--app-text-muted)]">
                {formatDate(reply.createdAt)}
              </span>
              <p className="mt-0.5 text-[var(--app-text)]">{reply.body}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
