"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AuditEvent = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetLabel: string | null;
  metadata: unknown;
  createdAt: string;
  actorUser: { id: string; name: string; email: string } | null;
};

const ACTION_LABELS: Record<string, string> = {
  WORKSPACE_UPDATED: "Actualizó la configuración",
  WORKSPACE_DELETED: "Eliminó el workspace",
  OWNERSHIP_TRANSFERRED: "Transfirió el ownership",
  MEMBER_INVITED: "Invitó a un miembro",
  MEMBER_ROLE_CHANGED: "Cambió el rol de un miembro",
  MEMBER_SUSPENDED: "Suspendió a un miembro",
  MEMBER_REACTIVATED: "Reactivó a un miembro",
  MEMBER_REMOVED: "Removió a un miembro",
};

export function WorkspaceAuditPanel({ workspaceId }: { workspaceId: string }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const loadAudit = useCallback(async (cursor?: string) => {
    const isMore = Boolean(cursor);
    if (isMore) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const suffix = cursor ? `?take=50&cursor=${encodeURIComponent(cursor)}` : "?take=50";
      const response = await fetch(`/api/workspaces/${workspaceId}/audit${suffix}`, { cache: "no-store" });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : "No se pudo cargar la auditoría";
        throw new Error(message);
      }
      if (!isAuditPayload(payload)) throw new Error("La respuesta de auditoría no tiene el formato esperado");
      setEvents((current) => (isMore ? [...current, ...payload.events] : payload.events));
      setNextCursor(payload.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la auditoría");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAudit(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAudit]);

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Auditoría de actividad</CardTitle>
            <CardDescription>Consulta quién realizó cambios administrativos en este workspace.</CardDescription>
          </div>
          <Button type="button" variant="outline" className="gap-2" onClick={() => void loadAudit()} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-[var(--app-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Cargando actividad...</div>
        ) : error ? (
          <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800"><p>{error}</p><Button type="button" variant="outline" onClick={() => void loadAudit()}>Reintentar</Button></div>
        ) : events.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--app-border)] px-4 py-8 text-center text-sm text-[var(--app-text-muted)]">Todavía no hay actividad administrativa registrada.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-[var(--app-border)]">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-[var(--app-surface-muted)] text-xs uppercase tracking-wide text-[var(--app-text-muted)]"><tr><th className="px-4 py-3 font-semibold">Actividad</th><th className="px-4 py-3 font-semibold">Actor</th><th className="px-4 py-3 font-semibold">Objetivo</th><th className="px-4 py-3 font-semibold">Fecha</th></tr></thead>
                <tbody className="divide-y divide-[var(--app-border)]">
                  {events.map((event) => <tr key={event.id}><td className="px-4 py-3 font-medium text-[var(--app-text-strong)]">{ACTION_LABELS[event.action] ?? event.action}</td><td className="px-4 py-3 text-[var(--app-text-muted)]">{event.actorUser?.name ?? event.actorUser?.email ?? "Sistema"}</td><td className="px-4 py-3 text-[var(--app-text-muted)]">{event.targetLabel ?? event.targetId ?? "Workspace"}</td><td className="px-4 py-3 text-[var(--app-text-muted)]"><time dateTime={event.createdAt}>{formatAuditDate(event.createdAt)}</time></td></tr>)}
                </tbody>
              </table>
            </div>
            {nextCursor ? <div className="mt-4 flex justify-center"><Button type="button" variant="outline" onClick={() => void loadAudit(nextCursor)} disabled={loadingMore}>{loadingMore ? "Cargando..." : "Cargar más"}</Button></div> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function isAuditPayload(value: unknown): value is { events: AuditEvent[]; nextCursor: string | null } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { events?: unknown; nextCursor?: unknown };
  return Array.isArray(candidate.events) && (typeof candidate.nextCursor === "string" || candidate.nextCursor === null);
}

function formatAuditDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
