"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, KeyRound, LifeBuoy, Loader2, LogOut, MailCheck, Save, ShieldOff, ShieldCheck, Trash2, X } from "lucide-react";
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
  adminProfile?: "SUPER_ADMIN" | "ADMIN" | "SUPPORT" | "BILLING_ADMIN" | "AUDITOR" | null;
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
  canManageAccess: canManageAccessProp,
  canManageLifecycle: canManageLifecycleProp,
  canImpersonate: canImpersonateProp,
  canRevokeSessions: canRevokeSessionsProp,
  canVerifyEmail: canVerifyEmailProp,
  plans,
  users,
}: {
  currentUserId?: string;
  isSuperAdmin?: boolean;
  canManageAccess?: boolean;
  canManageLifecycle?: boolean;
  canImpersonate?: boolean;
  canRevokeSessions?: boolean;
  canVerifyEmail?: boolean;
  plans: AdminPlanOption[];
  users: AdminUserRow[];
}) {
  const router = useRouter();
  const protectedUserId = currentUserId ?? "";
  const canManageAccess = canManageAccessProp ?? true;
  const canManageLifecycle = canManageLifecycleProp ?? true;
  const canImpersonate = canImpersonateProp ?? true;
  const canRevokeSessions = canRevokeSessionsProp ?? true;
  const canVerifyEmail = canVerifyEmailProp ?? true;
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");
  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? users[0] ?? null,
    [selectedUserId, users],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [verifiedUserIds, setVerifiedUserIds] = useState<ReadonlySet<string>>(new Set());
  const [permanentDeleteOpen, setPermanentDeleteOpen] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [deletionReason, setDeletionReason] = useState("");
  const [permanentDeleteError, setPermanentDeleteError] = useState<string | null>(null);

  if (!selectedUser) {
    return <p className="theme-dashed-panel theme-muted-text rounded-2xl border px-4 py-6 text-sm">No hay usuarios para administrar.</p>;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageAccess) {
      setMessage("Tu perfil no tiene permiso para modificar el acceso del usuario.");
      return;
    }
    setMessage(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: String(formData.get("role") ?? selectedUser.role),
          adminProfile: String(formData.get("adminProfile") ?? selectedUser.adminProfile ?? "") || null,
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

  function handleSupportSession() {
    setMessage(null);

    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/support-session`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { error?: string; redirectTo?: string } | null;
      if (!response.ok || !payload?.redirectTo) {
        setMessage(payload?.error ?? "No se pudo iniciar la sesión de soporte.");
        return;
      }
      window.location.assign(payload.redirectTo);
    });
  }

  function handleRevokeSessions() {
    setMessage(null);

    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/sessions/revoke`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setMessage(payload?.error ?? "No se pudieron cerrar las sesiones activas.");
        return;
      }

      setMessage("Sesiones activas revocadas. El usuario deberá iniciar sesión nuevamente.");
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

  function openPermanentDeleteDialog() {
    setConfirmationEmail("");
    setDeletionReason("");
    setPermanentDeleteError(null);
    setPermanentDeleteOpen(true);
  }

  function handlePermanentDelete() {
    const normalizedEmail = confirmationEmail.trim();
    const normalizedReason = deletionReason.trim();

    if (normalizedEmail.toLowerCase() !== selectedUser.email.toLowerCase()) {
      setPermanentDeleteError("Escribe exactamente el correo del usuario seleccionado para continuar.");
      return;
    }

    if (normalizedReason.length < 10) {
      setPermanentDeleteError("El motivo debe tener al menos 10 caracteres.");
      return;
    }

    setPermanentDeleteError(null);
    setMessage(null);

    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationEmail: normalizedEmail, reason: normalizedReason }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; expiresAt?: string } | null;

      if (!response.ok) {
        setPermanentDeleteError(payload?.error ?? "No se pudo crear la solicitud de eliminación.");
        return;
      }

      setPermanentDeleteOpen(false);
      setMessage(
        payload?.expiresAt
          ? `Solicitud creada. Otro administrador activo debe aprobarla antes del ${formatDateTime(payload.expiresAt)}. Después comenzará un periodo de restauración de 30 días.`
          : "Solicitud creada. Otro administrador activo debe aprobarla y luego comenzará un periodo de restauración de 30 días.",
      );
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
          <Select
            id="admin-user-role"
            name="role"
            defaultValue={selectedUser.role}
            disabled={!canManageAccess || !isSuperAdmin}
            key={`${selectedUser.id}-role-${selectedUser.role}`}
          >
            <option value="USER">Usuario</option>
            <option value="ADMIN">Administrador</option>
          </Select>
          {!isSuperAdmin ? <p className="theme-subtle-text text-xs">Solo el administrador principal puede cambiar roles.</p> : null}
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
          <Label htmlFor="admin-user-profile">Perfil administrativo</Label>
          <Select
            id="admin-user-profile"
            name="adminProfile"
            defaultValue={selectedUser.adminProfile ?? (selectedUser.role === "ADMIN" ? "ADMIN" : "")}
            disabled={!canManageAccess || !isSuperAdmin}
            key={`${selectedUser.id}-profile-${selectedUser.adminProfile ?? "none"}`}
          >
            <option value="">Sin perfil</option>
            <option value="SUPER_ADMIN" disabled>Administrador principal</option>
            <option value="ADMIN">Administrador operativo</option>
            <option value="SUPPORT">Soporte</option>
            <option value="BILLING_ADMIN">Facturación</option>
            <option value="AUDITOR">Auditor</option>
          </Select>
          {!isSuperAdmin ? <p className="theme-subtle-text text-xs">Solo el administrador principal puede cambiar perfiles.</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-user-plan">Membresia</Label>
          <Select
            id="admin-user-plan"
            name="membershipPlanSlug"
            defaultValue={selectedUser.planSlug || plans[0]?.slug}
            disabled={!canManageAccess}
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
            disabled={!canManageAccess}
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
            <Button type="button" variant="outline" disabled={isPending || !canVerifyEmail} onClick={handleVerifyEmail}>
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
          {canImpersonate ? (
            <Button type="button" variant="outline" disabled={isPending} onClick={handleSupportSession} className="gap-2">
              <LifeBuoy className="h-4 w-4" />
              Abrir soporte limitado
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={isPending || !canRevokeSessions}
            onClick={handleRevokeSessions}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesiones activas
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isPending || !canManageLifecycle || selectedUser.id === protectedUserId}
            onClick={handleStatusChange}
            className="gap-2"
          >
            {selectedUser.status === "ACTIVE" ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            {selectedUser.status === "ACTIVE" ? "Desactivar usuario" : "Reactivar usuario"}
          </Button>
          {isSuperAdmin && selectedUser.id !== protectedUserId ? (
            <Button type="button" variant="destructive" disabled={isPending} onClick={openPermanentDeleteDialog} className="gap-2 sm:col-span-2">
              <Trash2 className="h-4 w-4" />
              Solicitar eliminación permanente
            </Button>
          ) : null}
        </div>
      </div>

      <Button type="submit" disabled={isPending || !canManageAccess} className="w-full gap-2">
        <Save className="h-4 w-4" />
        {isPending ? "Guardando..." : "Guardar acceso"}
      </Button>

      {message ? <p className="theme-muted-panel theme-muted-text rounded-xl px-3 py-2 text-sm">{message}</p> : null}

      <Dialog.Root open={permanentDeleteOpen} onOpenChange={setPermanentDeleteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[0_28px_80px_-34px_rgba(15,23,42,0.42)] outline-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-base font-semibold text-[var(--app-text-strong)]">
                  Solicitar eliminación permanente
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm leading-5 text-[var(--app-text-muted)]">
                  Confirma que deseas solicitar la eliminación de <span className="font-medium text-[var(--app-text)]">{selectedUser.email}</span>.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  aria-label="Cerrar"
                  disabled={isPending}
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="theme-status-warning mt-4 flex items-start gap-2 rounded-xl border px-3 py-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Esta acción no elimina la cuenta inmediatamente: requiere MFA verificado, aprobación de otro administrador activo y luego mantiene la cuenta suspendida durante 30 días antes de poder ejecutar la eliminación definitiva.
              </p>
            </div>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="permanent-delete-email">Correo del usuario</Label>
                <Input
                  id="permanent-delete-email"
                  type="email"
                  value={confirmationEmail}
                  onChange={(event) => setConfirmationEmail(event.target.value)}
                  placeholder={selectedUser.email}
                  autoComplete="off"
                  disabled={isPending}
                />
                <p className="theme-subtle-text text-xs">Escribe {selectedUser.email} para confirmar.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="permanent-delete-reason">Motivo</Label>
                <textarea
                  id="permanent-delete-reason"
                  value={deletionReason}
                  onChange={(event) => setDeletionReason(event.target.value)}
                  placeholder="Describe el motivo de la eliminación (mínimo 10 caracteres)."
                  minLength={10}
                  maxLength={500}
                  rows={3}
                  disabled={isPending}
                  className="theme-surface-card theme-strong-text w-full rounded-xl border px-3 py-2 text-sm outline-none transition placeholder:text-[var(--app-text-muted)] focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
                <p className="theme-subtle-text text-right text-xs">{deletionReason.length}/500</p>
              </div>
            </div>

            {permanentDeleteError ? <p className="theme-status-error mt-4 rounded-xl border px-3 py-2 text-sm">{permanentDeleteError}</p> : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={isPending}>
                  Cancelar
                </Button>
              </Dialog.Close>
              <Button type="button" variant="destructive" onClick={handlePermanentDelete} disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {isPending ? "Enviando solicitud..." : "Confirmar solicitud"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </form>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}
