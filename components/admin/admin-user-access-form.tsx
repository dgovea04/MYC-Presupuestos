"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type AdminUserRow = {
  id: string;
  name: string;
  email: string;
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
  plans,
  users,
}: {
  plans: AdminPlanOption[];
  users: AdminUserRow[];
}) {
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");
  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? users[0] ?? null,
    [selectedUserId, users],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!selectedUser) {
    return <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No hay usuarios para administrar.</p>;
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
          <Select id="admin-user-role" name="role" defaultValue={selectedUser.role} key={`${selectedUser.id}-role`}>
            <option value="USER">Usuario</option>
            <option value="ADMIN">Administrador</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-user-status">Estado</Label>
          <Select id="admin-user-status" name="status" defaultValue={selectedUser.status} key={`${selectedUser.id}-status`}>
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
            key={`${selectedUser.id}-plan`}
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
            key={`${selectedUser.id}-tokens`}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p className="font-medium text-slate-900">Licencia efectiva</p>
        <p className="mt-1">
          {selectedUser.billingMode ?? "FREE"} · {selectedUser.billingProvider ?? "Manual/app"} · {selectedUser.billingStatus ?? "sin suscripcion"}
        </p>
        {selectedUser.currentPeriodEnd ? <p>Periodo hasta {formatDateLabel(selectedUser.currentPeriodEnd)}</p> : null}
        {selectedUser.graceEndsAt ? <p>Gracia Pro hasta {formatDateLabel(selectedUser.graceEndsAt)}</p> : null}
      </div>

      <Button type="submit" disabled={isPending} className="w-full gap-2">
        <Save className="h-4 w-4" />
        {isPending ? "Guardando..." : "Guardar acceso"}
      </Button>

      {message ? <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{message}</p> : null}
    </form>
  );
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}
