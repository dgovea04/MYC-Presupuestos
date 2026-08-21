import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { BASE_ROLE_CAPABILITIES, CUSTOMIZABLE_CAPABILITIES, type WorkspaceCapability } from "@/lib/workspace/capabilities";
import type { WorkspaceRole } from "@/types/workspace";

type PermissionsClient = Pick<PrismaClient, "companyMembership">;

export type ResolvedCapabilities = {
  capabilities: ReadonlySet<WorkspaceCapability>;
  role: WorkspaceRole;
  customRoleId: string | null;
};

/**
 * Resuelve las capacidades efectivas de un miembro. Si tiene rol personalizado
 * usa sus permisos (acotados a lo customizable); en caso contrario usa la
 * matriz base del rol actual. Un miembro no activo no recibe capacidades.
 */
export async function resolveWorkspaceCapabilities(options: {
  userId: string;
  companyId: string;
  client?: PermissionsClient;
}): Promise<ResolvedCapabilities> {
  const client = options.client ?? prisma;

  const membership = await client.companyMembership.findUnique({
    where: {
      companyId_userId: { companyId: options.companyId, userId: options.userId },
      company: { deletedAt: null },
    },
    select: {
      role: true,
      status: true,
      customRoleId: true,
      customRole: { select: { permissions: { select: { permissionKey: true } } } },
    },
  });

  const role = (membership?.role ?? "VIEWER") as WorkspaceRole;
  const customRoleId = membership?.customRoleId ?? null;

  if (!membership || membership.status !== "ACTIVE") {
    return { capabilities: new Set<WorkspaceCapability>(), role, customRoleId };
  }

  if (membership.customRoleId && membership.customRole) {
    const customCapabilities = membership.customRole.permissions
      .map((permission) => permission.permissionKey)
      .filter((key): key is WorkspaceCapability => CUSTOMIZABLE_CAPABILITIES.has(key as WorkspaceCapability));
    return { capabilities: new Set(customCapabilities), role, customRoleId };
  }

  return { capabilities: BASE_ROLE_CAPABILITIES[role], role, customRoleId };
}
