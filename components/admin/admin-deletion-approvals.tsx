"use client";

import { useState, useTransition } from "react";
import { Check, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AdminDeletionApproval = {
  id: string;
  targetUserId: string;
  targetEmail: string;
  requestedById: string | null;
  requestedByEmail: string | null;
  reason: string;
  expiresAt: string;
  createdAt: string;
};

type ScheduledDeletion = {
  id: string;
  targetUserId: string;
  targetEmail: string;
  reason: string;
  deletionScheduledAt: string;
};

export function AdminDeletionApprovals({
  currentUserId,
  canApprove,
  canManageGracePeriod,
  approvals,
  scheduledDeletions,
}: {
  currentUserId: string;
  canApprove: boolean;
  canManageGracePeriod: boolean;
  approvals: AdminDeletionApproval[];
  scheduledDeletions: ScheduledDeletion[];
}) {
  const [items, setItems] = useState(approvals);
  const [scheduledItems, setScheduledItems] = useState(scheduledDeletions);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (items.length === 0 && scheduledItems.length === 0) {
    return null;
  }

  function handleDecision(id: string, decision: "approve" | "reject") {
    setMessage(null);

    startTransition(async () => {
      const response = await fetch(`/api/admin/deletion-approvals/${id}/${decision}`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setMessage(payload?.error ?? "No se pudo procesar la solicitud.");
        return;
      }

      setItems((current) => current.filter((item) => item.id !== id));
      if (decision === "approve") {
        setMessage("Eliminación programada. La cuenta queda suspendida y podrá restaurarse durante 30 días.");
        window.location.reload();
      } else {
        setMessage("Solicitud de eliminación rechazada.");
      }
    });
  }

  function handleScheduledAction(id: string, action: "restore" | "execute") {
    setMessage(null);

    startTransition(async () => {
      const response = await fetch(`/api/admin/deletion-approvals/${id}/${action}`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setMessage(payload?.error ?? "No se pudo procesar la eliminación programada.");
        return;
      }

      setScheduledItems((current) => current.filter((item) => item.id !== id));
      setMessage(action === "restore" ? "Cuenta restaurada correctamente." : "Cuenta eliminada definitivamente.");
    });
  }

  return (
    <section className="theme-muted-panel space-y-5 rounded-2xl border px-4 py-4">
      {items.length > 0 ? (
        <div className="space-y-3">
          <div>
            <p className="theme-strong-text font-medium">Aprobaciones pendientes</p>
            <p className="theme-muted-text mt-1 text-xs">Las eliminaciones requieren un segundo administrador activo.</p>
          </div>
          <div className="grid gap-3">
            {items.map((approval) => {
              const isOwnRequest = approval.requestedById === currentUserId;
              const disabled = isPending || !canApprove || isOwnRequest;

              return (
                <div key={approval.id} className="theme-surface-card rounded-xl border p-3 text-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="theme-strong-text font-medium">Eliminar {approval.targetEmail}</p>
                      <p className="theme-muted-text mt-1">Solicitado por {approval.requestedByEmail ?? "administrador desconocido"}</p>
                      <p className="theme-muted-text mt-1">Motivo: {approval.reason}</p>
                      <p className="theme-subtle-text mt-1">Vence: {formatDateTime(approval.expiresAt)}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button type="button" variant="outline" disabled={disabled} onClick={() => handleDecision(approval.id, "reject")} className="gap-1">
                        <X className="h-4 w-4" />
                        Rechazar
                      </Button>
                      <Button type="button" variant="destructive" disabled={disabled} onClick={() => handleDecision(approval.id, "approve")} className="gap-1">
                        <Check className="h-4 w-4" />
                        Aprobar y programar
                      </Button>
                    </div>
                  </div>
                  {isOwnRequest ? <p className="theme-subtle-text mt-2 text-xs">No puedes aprobar tu propia solicitud.</p> : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {scheduledItems.length > 0 ? (
        <div className="space-y-3">
          <div>
            <p className="theme-strong-text font-medium">Cuentas en periodo de gracia</p>
            <p className="theme-muted-text mt-1 text-xs">La cuenta está suspendida. Solo el administrador principal puede restaurarla o ejecutar la eliminación tras 30 días.</p>
          </div>
          <div className="grid gap-3">
            {scheduledItems.map((deletion) => {
              return (
                <div key={deletion.id} className="theme-surface-card rounded-xl border p-3 text-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="theme-strong-text font-medium">{deletion.targetEmail}</p>
                      <p className="theme-muted-text mt-1">Motivo: {deletion.reason}</p>
                      <p className="theme-subtle-text mt-1">
                        Se puede eliminar desde: {formatDateTime(deletion.deletionScheduledAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button type="button" variant="outline" disabled={isPending || !canManageGracePeriod} onClick={() => handleScheduledAction(deletion.id, "restore")} className="gap-1">
                        <RotateCcw className="h-4 w-4" />
                        Restaurar
                      </Button>
                      <Button type="button" variant="destructive" disabled={isPending || !canManageGracePeriod} onClick={() => handleScheduledAction(deletion.id, "execute")} className="gap-1">
                        <Trash2 className="h-4 w-4" />
                        Eliminar definitivamente
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {message ? <p className="theme-muted-text rounded-xl border px-3 py-2 text-sm">{message}</p> : null}
    </section>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
