import { prisma } from "@/lib/db/prisma";
import { recordWorkspaceAudit } from "@/lib/workspace/audit";
import { requireWorkspaceOwner } from "@/lib/workspace/authorization";
import { CUSTOMIZABLE_CAPABILITIES, isWorkspaceCapability, type WorkspaceCapability } from "@/lib/workspace/capabilities";

export function sanitizeWorkspaceRolePermissions(permissions: unknown): WorkspaceCapability[] {
  if (!Array.isArray(permissions)) throw new Error("Permisos inválidos");
  const unique = new Set<WorkspaceCapability>();
  for (const permission of permissions) {
    if (typeof permission !== "string" || !isWorkspaceCapability(permission)) {
      throw new Error(`Permiso inválido: ${String(permission)}`);
    }
    if (!CUSTOMIZABLE_CAPABILITIES.has(permission)) {
      throw new Error(`No puedes asignar el permiso restringido: ${permission}`);
    }
    unique.add(permission);
  }
  return [...unique];
}

export async function listWorkspaceRoles(companyId: string) {
  return prisma.workspaceRole.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      description: true,
      version: true,
      isSystem: true,
      updatedAt: true,
      permissions: { select: { permissionKey: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function createWorkspaceRole(options: {
  companyId: string;
  actorUserId: string;
  name: string;
  description?: string | null;
  permissions: unknown;
}) {
  await requireWorkspaceOwner({ userId: options.actorUserId, companyId: options.companyId });
  const permissions = sanitizeWorkspaceRolePermissions(options.permissions);

  return prisma.$transaction(async (tx) => {
    const created = await tx.workspaceRole.create({
      data: {
        companyId: options.companyId,
        name: options.name.trim(),
        description: options.description?.trim() || null,
        permissions: { create: permissions.map((permissionKey) => ({ permissionKey })) },
      },
      include: { permissions: { select: { permissionKey: true } } },
    });
    await recordWorkspaceAudit(
      {
        companyId: options.companyId,
        actorUserId: options.actorUserId,
        action: "WORKSPACE_ROLE_CREATED",
        targetType: "WORKSPACE_ROLE",
        targetId: created.id,
        targetLabel: created.name,
        metadata: { permissions },
      },
      tx,
    );
    return created;
  });
}

export async function updateWorkspaceRole(options: {
  companyId: string;
  actorUserId: string;
  roleId: string;
  name: string;
  description?: string | null;
  permissions: unknown;
}) {
  await requireWorkspaceOwner({ userId: options.actorUserId, companyId: options.companyId });
  const permissions = sanitizeWorkspaceRolePermissions(options.permissions);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.workspaceRole.findFirst({ where: { id: options.roleId, companyId: options.companyId } });
    if (!existing) throw new Error("Rol no encontrado");
    if (existing.isSystem) throw new Error("No puedes modificar roles del sistema");

    const updated = await tx.workspaceRole.update({
      where: { id: options.roleId },
      data: {
        name: options.name.trim(),
        description: options.description?.trim() || null,
        version: { increment: 1 },
        permissions: { deleteMany: {}, create: permissions.map((permissionKey) => ({ permissionKey })) },
      },
      include: { permissions: { select: { permissionKey: true } } },
    });
    await recordWorkspaceAudit(
      {
        companyId: options.companyId,
        actorUserId: options.actorUserId,
        action: "WORKSPACE_ROLE_UPDATED",
        targetType: "WORKSPACE_ROLE",
        targetId: updated.id,
        targetLabel: updated.name,
        metadata: { permissions, version: updated.version },
      },
      tx,
    );
    return updated;
  });
}

export async function deleteWorkspaceRole(options: {
  companyId: string;
  actorUserId: string;
  roleId: string;
}) {
  await requireWorkspaceOwner({ userId: options.actorUserId, companyId: options.companyId });

  return prisma.$transaction(async (tx) => {
    const existing = await tx.workspaceRole.findFirst({ where: { id: options.roleId, companyId: options.companyId } });
    if (!existing) throw new Error("Rol no encontrado");
    if (existing.isSystem) throw new Error("No puedes eliminar roles del sistema");

    await tx.workspaceRole.delete({ where: { id: options.roleId } });
    await recordWorkspaceAudit(
      {
        companyId: options.companyId,
        actorUserId: options.actorUserId,
        action: "WORKSPACE_ROLE_DELETED",
        targetType: "WORKSPACE_ROLE",
        targetId: options.roleId,
        targetLabel: existing.name,
      },
      tx,
    );
    return { id: options.roleId };
  });
}
