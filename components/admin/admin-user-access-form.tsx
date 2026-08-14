"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, MailCheck, Save, ShieldOff, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: string | null;
  role: "ADMIN" | "USER";
  status: "ACTIVE" | "SUSPENDED";
  planSlug: string;
  billingMode?: string;
  billingProvider?: string | null;
  billingStatus?: string | null;
  currentPeriodEnd?: string | null;
  graceEndsAt?: string | null;
  aiTokenExtraMonthly: number;
};

type AdminPlanOption = {
  name: string;
  slug: string;
};

export function AdminUserAccessForm({
  currentUserId,
  isSuperAdmin,
  plans,
  users,
}: {
  currentUserId?: string;
  isSuperAdmin?: boolean;
  plans: AdminPlanOption[];
  users: AdminUserRow[];
}) {
  const router = useRouter();
  const protectedUserId = currentUserId ?? "";
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");
  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? users[0] ?? null,
    [selectedUserId, users],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [verifiedUserIds, setVerifiedUserIds] = useState<ReadonlySet<string>>(new Set());

  if (!selectedUser) {
    return <p className="theme-dashed-panel theme-muted-text rounded-2xl border px-4 py-6 text-sm">No hay usuarios para administrar.</p>;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: String(formData.get("role") ?? "USER"),
          status: String(formData.get("status") ?? "ACTIVE"),
          membershipPlanSlug: String(formData.get("membershipPlanSlug") ?? ""),
          aiTokenExtraMonthly: Number(formData.get("aiTokenExtraMonthly") ?? 0),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setMessage(payload.error ?? "No se pudo actualizar el usuario.");
        return;
      }

      setMessage("Usuario actualizado. Refresca la vista si necesitas ver los totales recalculados.");
    });
  }

  const isEmailVerified = Boolean(selectedUser.emailVerifiedAt) || verifiedUserIds.has(selectedUser.id);

  function handleVerifyEmail() {
    setMessage(null);

    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/verify-email`, {
        method: "PATCH",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(payload?.error ?? "No se pudo validar el correo.");
        return;
      }

      setVerifiedUserIds((current) => new Set([...current, selectedUser.id]));
      setMessage("Correo validado manualmente.");
      router.refresh();
    });
  }

  function handlePasswordReset() {
    setMessage(null);

    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/password-reset`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setMessage(payload?.error ?? "No se pudo enviar el enlace de cambio de contrasena.");
        return;
      }

      setMessage("Enlace de cambio de contrasena enviado por correo.");
    });
  }

  function handleStatusChange() {
    const nextStatus = selectedUser.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setMessage(null);

    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/lifecycle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setMessage(payload?.error ?? "No se pudo actualizar el estado del usuario.");
        return;
      }

      setMessage(nextStatus === "SUSPENDED" ? "Usuario desactivado." : "Usuario reactivado.");
      router.refresh();
    });
  }

  function handlePermanentDelete() {
    const confirmationEmail = window.prompt(`Escribe ${selectedUser.email} para confirmar la eliminacion permanente.`);

    if (confirmationEmail === null) {
      return;
    }

    setMessage(null);

    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationEmail }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setMessage(payload?.error ?? "No se pudo eliminar el usuario.");
        return;
      }

      setMessage("Usuario eliminado permanentemente.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="admin-user-id">Usuario</Label>
        <Select
          id="admin-user-id"
          value={selectedUserId}
          onChange={(event) => setSelectedUserId(event.currentTarget.value)}
        >
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} - {user.email}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="admin-user-role">Rol</Label>
          <Select id="admin-user-role" name="role" defaultValue={selectedUser.role} key={`${selectedUser.id}-role-${selectedUser.role}`}>
            <option value="USER">Usuario</option>
            <option value="ADMIN">Administrador</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-user-status">Estado</Label>
          <Select id="admin-user-status" name="status" defaultValue={selectedUser.status} key={`${selectedUser.id}-status-${selectedUser.status}`}>
            <option value="ACTIVE">Activo</option>
            <option value="SUSPENDED">Suspendido</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="admin-user-plan">Membresia</Label>
          <Select
            id="admin-user-plan"
            name="membershipPlanSlug"
            defaultValue={selectedUser.planSlug || plans[0]?.slug}
            key={`${selectedUser.id}-plan-${selectedUser.planSlug}`}
          >
            {plans.map((plan) => (
              <option key={plan.slug} value={plan.slug}>
                {plan.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-user-extra-tokens">Tokens extra</Label>
          <Input
            id="admin-user-extra-tokens"
            name="aiTokenExtraMonthly"
            type="number"
            min={0}
            step={1}
            defaultValue={selectedUser.aiTokenExtraMonthly}
            key={`${selectedUser.id}-tokens-${selectedUser.aiTokenExtraMonthly}`}
          />
        </div>
      </div>

      <div className="theme-muted-panel theme-muted-text rounded-2xl border px-4 py-3 text-sm">
        <p className="theme-strong-text font-medium">Licencia efectiva</p>
        <p className="mt-1">
          {selectedUser.billingMode ?? "FREE"} · {selectedUser.billingProvider ?? "Manual/app"} · {selectedUser.billingStatus ?? "sin suscripcion"}
        </p>
        {selectedUser.currentPeriodEnd ? <p>Periodo hasta {formatDateLabel(selectedUser.currentPeriodEnd)}</p> : null}
        {selectedUser.graceEndsAt ? <p>Gracia Pro hasta {formatDateLabel(selectedUser.graceEndsAt)}</p> : null}
      </div>

      <div className="theme-muted-panel rounded-2xl border px-4 py-3 text-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="theme-filter-button-active inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
              <MailCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="theme-strong-text font-medium">{isEmailVerified ? "Correo verificado" : "Correo pendiente de validacion"}</p>
              <p className="theme-muted-text mt-1">{selectedUser.email}</p>
            </div>
          </div>
          {!isEmailVerified ? (
            <Button type="button" variant="outline" disabled={isPending} onClick={handleVerifyEmail}>
              {isPending ? "Validando..." : "Validar correo"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="theme-muted-panel space-y-3 rounded-2xl border px-4 py-3">
        <div>
          <p className="theme-strong-text font-medium">Acciones avanzadas</p>
          <p className="theme-muted-text mt-1 text-xs">Las acciones quedan registradas para control administrativo.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {isSuperAdmin ? (
            <Button type="button" variant="outline" disabled={isPending} onClick={handlePasswordReset} className="gap-2">
              <KeyRound className="h-4 w-4" />
              Enviar cambio de contrasena
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={isPending || selectedUser.id === protectedUserId}
            onClick={handleStatusChange}
            className="gap-2"
          >
            {selectedUser.status === "ACTIVE" ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            {selectedUser.status === "ACTIVE" ? "Desactivar usuario" : "Reactivar usuario"}
          </Button>
          {isSuperAdmin && selectedUser.id !== protectedUserId ? (
            <Button type="button" variant="destructive" disabled={isPending} onClick={handlePermanentDelete} className="gap-2 sm:col-span-2">
              <Trash2 className="h-4 w-4" />
              Eliminar permanentemente
            </Button>
          ) : null}
        </div>
      </div>

      <Button type="submit" disabled={isPending} className="w-full gap-2">
        <Save className="h-4 w-4" />
        {isPending ? "Guardando..." : "Guardar acceso"}
      </Button>

      {message ? <p className="theme-muted-panel theme-muted-text rounded-xl px-3 py-2 text-sm">{message}</p> : null}
    </form>
  );
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}
