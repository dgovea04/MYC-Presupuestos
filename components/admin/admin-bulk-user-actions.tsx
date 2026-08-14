"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AdminBulkUser = {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "SUSPENDED";
};

export function AdminBulkUserActions({
  users,
  currentUserId,
  canManageLifecycle,
  canRevokeSessions,
}: {
  users: AdminBulkUser[];
  currentUserId: string;
  canManageLifecycle: boolean;
  canRevokeSessions: boolean;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedUsers = useMemo(() => users.filter((user) => selectedIds.has(user.id)), [selectedIds, users]);
  const hasCurrentUser = selectedIds.has(currentUserId);

  if (users.length === 0) {
    return null;
  }

  function toggleUser(userId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((current) => (current.size === users.length ? new Set() : new Set(users.map((user) => user.id))));
  }

  function runAction(action: "SUSPEND" | "REACTIVATE" | "REVOKE_SESSIONS") {
    if (selectedIds.size === 0) {
      setMessage("Selecciona al menos un usuario.");
      return;
    }

    if (action === "SUSPEND" && hasCurrentUser) {
      setMessage("Quita tu propia cuenta de la selección antes de suspender usuarios.");
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [...selectedIds], action }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; affectedUsers?: number } | null;

      if (!response.ok) {
        setMessage(payload?.error ?? "No se pudo completar la operación masiva.");
        return;
      }

      setSelectedIds(new Set());
      setMessage(`${payload?.affectedUsers ?? selectedUsers.length} usuarios actualizados correctamente.`);
      router.refresh();
    });
  }

  return (
    <div className="theme-muted-panel space-y-3 rounded-2xl border px-4 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="theme-strong-text font-medium">Acciones masivas</p>
          <p className="theme-muted-text mt-1 text-xs">Opera solo sobre los usuarios visibles. Máximo 50 por operación.</p>
        </div>
        <label className="theme-muted-text inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selectedIds.size === users.length} onChange={toggleAll} />
          Seleccionar visibles
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((user) => (
          <label key={user.id} className="theme-surface-card flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm">
            <input type="checkbox" checked={selectedIds.has(user.id)} onChange={() => toggleUser(user.id)} />
            <span className="min-w-0 truncate">
              <span className="theme-strong-text block truncate">{user.name}</span>
              <span className="theme-muted-text block truncate text-xs">{user.email}</span>
            </span>
            <span className="theme-subtle-text ml-auto text-xs">{user.status === "ACTIVE" ? "Activo" : "Suspendido"}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={isPending || !canManageLifecycle} onClick={() => runAction("SUSPEND")} className="gap-2">
          <ShieldOff className="h-4 w-4" />
          Suspender seleccionados
        </Button>
        <Button type="button" variant="outline" disabled={isPending || !canManageLifecycle} onClick={() => runAction("REACTIVATE")} className="gap-2">
          <ShieldCheck className="h-4 w-4" />
          Reactivar seleccionados
        </Button>
        <Button type="button" variant="outline" disabled={isPending || !canRevokeSessions} onClick={() => runAction("REVOKE_SESSIONS")} className="gap-2">
          <LogOut className="h-4 w-4" />
          Revocar sesiones
        </Button>
      </div>
      {message ? <p className="theme-muted-text rounded-xl border px-3 py-2 text-sm">{message}</p> : null}
    </div>
  );
}
