"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CUSTOMIZABLE_CAPABILITIES, WORKSPACE_CAPABILITIES, type WorkspaceCapability } from "@/lib/workspace/capabilities";

type Role = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isSystem: boolean;
  updatedAt: string;
  permissions: { permissionKey: string }[];
};

const MODULE_LABELS: Record<string, string> = {
  workspace: "Workspace",
  members: "Miembros",
  budgets: "Presupuestos",
  projects: "Proyectos",
  resources: "Catálogo de insumos",
};

const capabilitiesByModule = WORKSPACE_CAPABILITIES.reduce<Record<string, { key: WorkspaceCapability; description: string }[]>>((acc, capability) => {
  (acc[capability.module] ??= []).push({ key: capability.key, description: capability.description });
  return acc;
}, {});

export function WorkspaceRolesPanel({ workspaceId }: { workspaceId: string }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<WorkspaceCapability>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadRoles = () => {
    setLoading(true);
    setError("");
    void fetch(`/api/workspaces/${workspaceId}/roles`, { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok || !isRolesPayload(payload)) throw new Error(readError(payload, "No se pudieron cargar los roles"));
        setRoles(payload.roles);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudieron cargar los roles"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = window.setTimeout(() => loadRoles(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const modules = useMemo(() => Object.entries(capabilitiesByModule), []);

  const resetForm = () => {
    setName("");
    setDescription("");
    setSelected(new Set());
    setEditingId(null);
  };

  async function handleSubmit() {
    if (!name.trim() || pending) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const body = { name, description: description || null, permissions: [...selected] };
      const response = await fetch(`/api/workspaces/${workspaceId}/roles`, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...body, roleId: editingId } : body),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(readError(payload, "No se pudo guardar el rol"));
      resetForm();
      setNotice(editingId ? "Rol actualizado." : "Rol creado.");
      loadRoles();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo guardar el rol");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(roleId: string) {
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/roles`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(readError(payload, "No se pudo eliminar el rol"));
      setNotice("Rol eliminado.");
      loadRoles();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el rol");
    } finally {
      setPending(false);
    }
  }

  function toggle(capability: WorkspaceCapability) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(capability)) next.delete(capability);
      else if (CUSTOMIZABLE_CAPABILITIES.has(capability)) next.add(capability);
      return next;
    });
  }

  function startEdit(role: Role) {
    setEditingId(role.id);
    setName(role.name);
    setDescription(role.description ?? "");
    setSelected(new Set(role.permissions.map((p) => p.permissionKey as WorkspaceCapability)));
  }

  return (
    <div className="space-y-6">
      <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {editingId ? "Editar rol personalizado" : "Crear rol personalizado"}
          </CardTitle>
          <CardDescription>Los roles personalizados no pueden otorgar permisos exclusivos del Owner ni superar el nivel Admin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              Nombre
              <input className="flex h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Descripción
              <input className="flex h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
          </div>

          <div className="space-y-4">
            {modules.map(([module, capabilities]) => (
              <fieldset key={module} className="rounded-2xl border border-[var(--app-border)] p-4">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">{MODULE_LABELS[module] ?? module}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {capabilities.map((capability) => (
                    <label key={capability.key} className="flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-0.5" checked={selected.has(capability.key)} disabled={!CUSTOMIZABLE_CAPABILITIES.has(capability.key)} onChange={() => toggle(capability.key)} />
                      <span>
                        <span className="block font-medium text-[var(--app-text-strong)]">{capability.key}</span>
                        <span className="block text-xs text-[var(--app-text-muted)]">{capability.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" className="gap-2" disabled={pending || !name.trim()} onClick={() => void handleSubmit()}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingId ? "Guardar cambios" : "Crear rol"}
            </Button>
            {editingId ? <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button> : null}
          </div>

          {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        </CardContent>
      </Card>

      <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
        <CardHeader>
          <CardTitle>Roles del workspace</CardTitle>
          <CardDescription>Los roles se asignan a los miembros desde la sección de miembros.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-[var(--app-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Cargando roles...</div>
          ) : roles.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--app-border)] px-4 py-8 text-center text-sm text-[var(--app-text-muted)]">Todavía no hay roles personalizados.</p>
          ) : (
            <div className="space-y-3">
              {roles.map((role) => (
                <div key={role.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--app-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[var(--app-text-strong)]">{role.name}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">v{role.version}</span>
                      {role.isSystem ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700">Sistema</span> : null}
                    </div>
                    <p className="text-sm text-[var(--app-text-muted)]">{role.description ?? "Sin descripción"}</p>
                    <p className="mt-1 truncate text-xs text-[var(--app-text-subtle)]">{role.permissions.length ? role.permissions.map((p) => p.permissionKey).join(", ") : "Sin permisos"}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" variant="outline" className="w-fit" onClick={() => startEdit(role)}>Editar</Button>
                    <Button type="button" variant="ghost" className="w-fit gap-2 text-rose-600 hover:text-rose-700" disabled={pending || role.isSystem} onClick={() => void handleDelete(role.id)}>
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function isRolesPayload(value: unknown): value is { roles: Role[] } {
  return typeof value === "object" && value !== null && "roles" in value && Array.isArray((value as { roles?: unknown }).roles);
}

function readError(value: unknown, fallback: string) {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string" ? value.error : fallback;
}
