"use client";
import { useCallback, useEffect, useState } from "react";
import type { CollaborationCommentRecord } from "@/types/collaboration";
type Input = { budgetId: string; entityType: string; entityId: string };
export function useCollaborationComments(input: Input) {
  const [comments, setComments] = useState<CollaborationCommentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => { setLoading(true); try { const response = await fetch(`/api/budgets/${input.budgetId}/collaboration/comments?entityType=${encodeURIComponent(input.entityType)}&entityId=${encodeURIComponent(input.entityId)}`); const data = await response.json() as { comments?: CollaborationCommentRecord[]; error?: string }; if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar los comentarios"); setComments(data.comments ?? []); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudieron cargar los comentarios"); } finally { setLoading(false); } }, [input.budgetId, input.entityId, input.entityType]);
  useEffect(() => { const timer = window.setTimeout(() => { void refresh(); }, 0); return () => window.clearTimeout(timer); }, [refresh]);
  const create = useCallback(async (body: { body: string; mentions?: string[]; parentCommentId?: string }) => { const response = await fetch(`/api/budgets/${input.budgetId}/collaboration/comments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, entityType: input.entityType, entityId: input.entityId }) }); if (response.status === 409) throw new Error("El comentario cambió; actualiza e inténtalo de nuevo."); if (!response.ok) throw new Error("No se pudo crear el comentario"); await refresh(); }, [input, refresh]);
  const resolve = useCallback(async (commentId: string, resolved: boolean) => { const response = await fetch(`/api/budgets/${input.budgetId}/collaboration/comments/${commentId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ resolved }) }); if (response.status === 409) throw new Error("El comentario cambió; actualiza e inténtalo de nuevo."); if (!response.ok) throw new Error("No se pudo actualizar el comentario"); await refresh(); }, [input.budgetId, refresh]);
  return { comments, loading, error, create, resolve, refresh };
}
