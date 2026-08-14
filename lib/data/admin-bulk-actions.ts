import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAdminAudit, type AdminAuditInput } from "@/lib/data/admin-audit";

export const ADMIN_BULK_USER_LIMIT = 50;
export type AdminBulkUserAction = "SUSPEND" | "REACTIVATE" | "REVOKE_SESSIONS";
type AdminActionContext = Pick<AdminAuditInput, "ipAddress" | "userAgent">;

type TargetUser = {
  id: string;
  email: string;
  role: "ADMIN" | "USER";
  status: "ACTIVE" | "SUSPENDED";
  isSuperAdmin: boolean;
};

export async function performBulkAdminUserAction(input: {
  userIds: string[];
  action: AdminBulkUserAction;
  actorUserId: string;
  context?: AdminActionContext;
}) {
  const userIds = [...new Set(input.userIds.map((userId) => userId.trim()).filter(Boolean))];

  if (userIds.length === 0) {
    throw new Error("Selecciona al menos un usuario.");
  }

  if (userIds.length > ADMIN_BULK_USER_LIMIT) {
    throw new Error(`No puedes seleccionar más de ${ADMIN_BULK_USER_LIMIT} usuarios por operación.`);
  }

  const targets = await prisma.$queryRaw<TargetUser[]>`
    SELECT "id", "email", "role", "status", "isSuperAdmin"
    FROM "User"
    WHERE "id" IN (${Prisma.join(userIds)})
  `;

  if (targets.length !== userIds.length) {
    throw new Error("Uno o más usuarios seleccionados ya no existen.");
  }

  if (input.action !== "REVOKE_SESSIONS" && targets.some((target) => target.isSuperAdmin)) {
    throw new Error("El administrador principal no puede modificarse mediante acciones masivas.");
  }

  if (input.action === "SUSPEND" && userIds.includes(input.actorUserId)) {
    throw new Error("No puedes suspender tu propia cuenta.");
  }

  if (input.action === "SUSPEND") {
    const activeAdmins = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS "count"
      FROM "User"
      WHERE "role" = 'ADMIN' AND "status" = 'ACTIVE'
    `;
    const selectedActiveAdmins = targets.filter((target) => target.role === "ADMIN" && target.status === "ACTIVE").length;

    if (Number(activeAdmins[0]?.count ?? 0) - selectedActiveAdmins < 1) {
      throw new Error("La operación dejaría el sistema sin administradores activos.");
    }
  }

  const bulkId = randomUUID();

  await prisma.$transaction(async (tx) => {
    for (const userId of userIds) {
      if (input.action === "SUSPEND") {
        await tx.$executeRaw`
          UPDATE "User"
          SET "status" = 'SUSPENDED', "sessionVersion" = "sessionVersion" + 1, "updatedAt" = NOW()
          WHERE "id" = ${userId}
        `;
      } else if (input.action === "REACTIVATE") {
        await tx.$executeRaw`
          UPDATE "User"
          SET "status" = 'ACTIVE', "sessionVersion" = "sessionVersion" + 1, "updatedAt" = NOW()
          WHERE "id" = ${userId}
        `;
      } else {
        await tx.$executeRaw`
          UPDATE "User"
          SET "sessionVersion" = "sessionVersion" + 1, "updatedAt" = NOW()
          WHERE "id" = ${userId}
        `;
      }
    }
  });

  const auditAction = getAuditAction(input.action);
  await Promise.all(
    targets.map((target) =>
      recordAdminAudit({
        actorUserId: input.actorUserId,
        targetUserId: target.id,
        targetEmail: target.email,
        action: auditAction,
        detail: getAuditDetail(input.action),
        metadata: { bulkId, bulkAction: input.action },
        ...input.context,
      }),
    ),
  );

  return { bulkId, affectedUsers: targets.length };
}

function getAuditAction(action: AdminBulkUserAction) {
  if (action === "SUSPEND") return "USER_BULK_SUSPENDED";
  if (action === "REACTIVATE") return "USER_BULK_REACTIVATED";
  return "USER_BULK_SESSIONS_REVOKED";
}

function getAuditDetail(action: AdminBulkUserAction) {
  if (action === "SUSPEND") return "Usuario suspendido mediante una operación masiva.";
  if (action === "REACTIVATE") return "Usuario reactivado mediante una operación masiva.";
  return "Sesiones del usuario revocadas mediante una operación masiva.";
}
