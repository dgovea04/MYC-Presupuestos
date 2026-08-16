import { randomUUID } from "node:crypto";
import { notifyPrimaryAdminSecurityEvent } from "@/lib/auth/admin-security-alert";
import { prisma } from "@/lib/db/prisma";
import { recordAdminAudit, type AdminAuditInput } from "@/lib/data/admin-audit";

const APPROVAL_TTL_MS = 15 * 60 * 1000;
const DELETION_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

type AdminActionContext = Pick<AdminAuditInput, "ipAddress" | "userAgent">;

type ApprovalRow = {
  id: string;
  targetUserId: string | null;
  targetEmail: string;
  requestedById: string | null;
  requestedByEmail: string | null;
  confirmationEmail: string;
  reason: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
};

export type PendingAdminDeletionApproval = {
  id: string;
  targetUserId: string;
  targetEmail: string;
  requestedById: string | null;
  requestedByEmail: string | null;
  reason: string;
  expiresAt: string;
  createdAt: string;
};

export async function requestAdminUserDeletion(
  userId: string,
  actorUserId: string,
  confirmationEmail: string,
  reason: string,
  context?: AdminActionContext,
) {
  const actors = await prisma.$queryRaw<Array<{ isSuperAdmin: boolean; status: string }>>`
    SELECT "isSuperAdmin", "status"
    FROM "User"
    WHERE "id" = ${actorUserId}
    LIMIT 1
  `;

  if (!actors[0]?.isSuperAdmin || actors[0].status !== "ACTIVE") {
    throw new Error("Solo el administrador principal activo puede solicitar una eliminación permanente.");
  }

  const users = await prisma.$queryRaw<Array<{ email: string; isSuperAdmin: boolean; deletionScheduledAt: Date | null }>>`
    SELECT "email", "isSuperAdmin", "deletionScheduledAt"
    FROM "User"
    WHERE "id" = ${userId}
    LIMIT 1
  `;
  const user = users[0];

  if (!user) {
    throw new Error("Usuario no encontrado.");
  }

  if (user.isSuperAdmin) {
    throw new Error("El administrador principal no puede ser eliminado.");
  }

  if (user.deletionScheduledAt) {
    throw new Error("El usuario ya tiene una eliminación programada.");
  }

  if (confirmationEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    throw new Error("La confirmación no coincide con el correo del usuario.");
  }

  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS);
  const approvalId = randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "admin_deletion_approvals"
      SET "status" = 'EXPIRED', "decidedAt" = NOW()
      WHERE "targetUserId" = ${userId}
        AND "status" = 'PENDING'
        AND "expiresAt" <= NOW()
    `;

    await tx.$executeRaw`
      INSERT INTO "admin_deletion_approvals" (
        "id", "targetUserId", "targetEmail", "requestedById", "confirmationEmail", "reason", "status", "expiresAt"
      )
      VALUES (
        ${approvalId}, ${userId}, ${user.email}, ${actorUserId}, ${confirmationEmail.trim()}, ${reason.trim()}, 'PENDING', ${expiresAt}
      )
    `;
  });

  await recordAdminAudit({
    actorUserId,
    targetUserId: userId,
    targetEmail: user.email,
    action: "USER_DELETION_REQUESTED",
    detail: `Solicitud de eliminación permanente creada. Motivo: ${reason.trim()}`,
    metadata: { approvalId, reason: reason.trim(), expiresAt: expiresAt.toISOString() },
    ...context,
  });

  return { approvalId, targetEmail: user.email, expiresAt };
}

export async function listPendingAdminDeletionApprovals(): Promise<PendingAdminDeletionApproval[]> {
  const rows = await prisma.$queryRaw<ApprovalRow[]>`
    SELECT
      approvals."id",
      approvals."targetUserId",
      approvals."targetEmail",
      approvals."requestedById",
      requester."email" AS "requestedByEmail",
      approvals."confirmationEmail",
      approvals."reason",
      approvals."status",
      approvals."expiresAt",
      approvals."createdAt"
    FROM "admin_deletion_approvals" AS approvals
    LEFT JOIN "User" AS requester ON requester."id" = approvals."requestedById"
    WHERE approvals."status" = 'PENDING'
      AND approvals."expiresAt" > NOW()
    ORDER BY approvals."createdAt" DESC
  `;

  return rows.flatMap((row) =>
    row.targetUserId
      ? [{
          id: row.id,
          targetUserId: row.targetUserId,
          targetEmail: row.targetEmail,
          requestedById: row.requestedById,
          requestedByEmail: row.requestedByEmail,
          reason: row.reason,
          expiresAt: row.expiresAt.toISOString(),
          createdAt: row.createdAt.toISOString(),
        }]
      : [],
  );
}

export async function approveAdminUserDeletion(approvalId: string, approverUserId: string, context?: AdminActionContext) {
  const approvers = await prisma.$queryRaw<Array<{ email: string; status: string; role: string }>>`
    SELECT "email", "status", "role"
    FROM "User"
    WHERE "id" = ${approverUserId}
    LIMIT 1
  `;
  const approver = approvers[0];

  if (!approver || approver.status !== "ACTIVE" || approver.role !== "ADMIN") {
    throw new Error("El aprobador debe ser un administrador activo.");
  }

  await prisma.$executeRaw`
    UPDATE "admin_deletion_approvals"
    SET "status" = 'EXPIRED', "decidedAt" = NOW()
    WHERE "status" = 'PENDING' AND "expiresAt" <= NOW()
  `;

  const approvals = await prisma.$queryRaw<ApprovalRow[]>`
    SELECT
      approvals."id",
      approvals."targetUserId",
      approvals."targetEmail",
      approvals."requestedById",
      requester."email" AS "requestedByEmail",
      approvals."confirmationEmail",
      approvals."reason",
      approvals."status",
      approvals."expiresAt",
      approvals."createdAt"
    FROM "admin_deletion_approvals" AS approvals
    LEFT JOIN "User" AS requester ON requester."id" = approvals."requestedById"
    WHERE approvals."id" = ${approvalId}
    LIMIT 1
  `;
  const approval = approvals[0];

  if (!approval || approval.status !== "PENDING") {
    throw new Error("La solicitud ya no está pendiente.");
  }

  if (!approval.targetUserId) {
    throw new Error("El usuario objetivo ya no está disponible.");
  }

  if (approval.requestedById === approverUserId) {
    throw new Error("La persona que solicita la eliminación no puede aprobarla.");
  }

  const deletionScheduledAt = new Date(Date.now() + DELETION_GRACE_PERIOD_MS);

  await prisma.$transaction(async (tx) => {
    const scheduledUsers = await tx.$executeRaw`
      UPDATE "User"
      SET "deletionPreviousStatus" = "status",
          "status" = 'SUSPENDED',
          "sessionVersion" = "sessionVersion" + 1,
          "deletionScheduledAt" = ${deletionScheduledAt},
          "deletionReason" = ${approval.reason},
          "updatedAt" = NOW()
      WHERE "id" = ${approval.targetUserId}
        AND "email" = ${approval.confirmationEmail}
        AND "isSuperAdmin" = false
        AND EXISTS (
          SELECT 1
          FROM "admin_deletion_approvals"
          WHERE "id" = ${approvalId}
            AND "status" = 'PENDING'
            AND "expiresAt" > NOW()
        )
    `;

    if (scheduledUsers === 0) {
      throw new Error("El usuario objetivo ya no existe o no puede ser programado para eliminación.");
    }

    await tx.$executeRaw`
      UPDATE "admin_deletion_approvals"
      SET "status" = 'SCHEDULED', "approvedById" = ${approverUserId}, "decidedAt" = NOW()
      WHERE "id" = ${approvalId} AND "status" = 'PENDING'
    `;
  });

  await recordAdminAudit({
    actorUserId: approverUserId,
    targetUserId: approval.targetUserId,
    targetEmail: approval.targetEmail,
    action: "USER_DELETION_SCHEDULED",
    detail: `Eliminación programada después de aprobación de dos pasos. La cuenta podrá restaurarse durante 30 días. Motivo: ${approval.reason}`,
    metadata: {
      approvalId,
      requestedById: approval.requestedById,
      reason: approval.reason,
    },
    ...context,
  });

  return {
    targetEmail: approval.targetEmail,
    reason: approval.reason,
    scheduledAt: deletionScheduledAt,
  };
}

export async function restoreAdminUserDeletion(approvalId: string, actorUserId: string, context?: AdminActionContext) {
  const actors = await prisma.$queryRaw<Array<{ email: string; status: string; isSuperAdmin: boolean }>>`
    SELECT "email", "status", "isSuperAdmin"
    FROM "User"
    WHERE "id" = ${actorUserId}
    LIMIT 1
  `;
  if (!actors[0]?.isSuperAdmin || actors[0].status !== "ACTIVE") {
    throw new Error("Solo el administrador principal activo puede restaurar cuentas.");
  }

  const approvals = await prisma.$queryRaw<ApprovalRow[]>`
    SELECT "id", "targetUserId", "targetEmail", "requestedById", NULL::text AS "requestedByEmail", "confirmationEmail", "reason", "status", "expiresAt", "createdAt"
    FROM "admin_deletion_approvals"
    WHERE "id" = ${approvalId}
    LIMIT 1
  `;
  const approval = approvals[0];
  if (!approval || approval.status !== "SCHEDULED" || !approval.targetUserId) {
    throw new Error("La eliminación programada ya no está disponible.");
  }

  await prisma.$transaction(async (tx) => {
    const restoredUsers = await tx.$executeRaw`
      UPDATE "User"
      SET "status" = COALESCE("deletionPreviousStatus", 'ACTIVE'),
          "deletionPreviousStatus" = NULL,
          "sessionVersion" = "sessionVersion" + 1,
          "deletionScheduledAt" = NULL,
          "deletionReason" = NULL,
          "updatedAt" = NOW()
      WHERE "id" = ${approval.targetUserId}
        AND "deletionScheduledAt" > NOW()
    `;
    if (restoredUsers === 0) throw new Error("La cuenta ya no está pendiente de eliminación.");

    await tx.$executeRaw`
      UPDATE "admin_deletion_approvals"
      SET "status" = 'RESTORED', "approvedById" = ${actorUserId}, "decidedAt" = NOW()
      WHERE "id" = ${approvalId} AND "status" = 'SCHEDULED'
    `;
  });

  await recordAdminAudit({ actorUserId, targetUserId: approval.targetUserId, targetEmail: approval.targetEmail, action: "USER_DELETION_RESTORED", detail: "Cuenta restaurada durante el periodo de gracia de eliminación.", metadata: { approvalId }, ...context });

  return { targetEmail: approval.targetEmail };
}

export async function executeAdminUserDeletion(approvalId: string, actorUserId: string, context?: AdminActionContext) {
  const actors = await prisma.$queryRaw<Array<{ email: string; status: string; isSuperAdmin: boolean }>>`
    SELECT "email", "status", "isSuperAdmin"
    FROM "User"
    WHERE "id" = ${actorUserId}
    LIMIT 1
  `;
  if (!actors[0]?.isSuperAdmin || actors[0].status !== "ACTIVE") {
    throw new Error("Solo el administrador principal activo puede ejecutar eliminaciones.");
  }

  const approvals = await prisma.$queryRaw<Array<ApprovalRow & { deletionScheduledAt: Date | null }>>`
    SELECT approvals."id", approvals."targetUserId", approvals."targetEmail", approvals."requestedById", NULL::text AS "requestedByEmail", approvals."confirmationEmail", approvals."reason", approvals."status", approvals."expiresAt", approvals."createdAt", target."deletionScheduledAt"
    FROM "admin_deletion_approvals" AS approvals
    LEFT JOIN "User" AS target ON target."id" = approvals."targetUserId"
    WHERE approvals."id" = ${approvalId}
    LIMIT 1
  `;
  const approval = approvals[0];
  if (!approval || approval.status !== "SCHEDULED" || !approval.targetUserId || !approval.deletionScheduledAt) {
    throw new Error("La eliminación programada ya no está disponible.");
  }
  if (approval.deletionScheduledAt > new Date()) {
    throw new Error("El periodo de gracia de 30 días todavía no ha vencido.");
  }

  await prisma.$transaction(async (tx) => {
    const claimedApprovals = await tx.$executeRaw`
      UPDATE "admin_deletion_approvals"
      SET "status" = 'EXECUTED', "approvedById" = ${actorUserId}, "executedAt" = NOW()
      WHERE "id" = ${approvalId} AND "status" = 'SCHEDULED'
    `;
    if (claimedApprovals === 0) throw new Error("La eliminación ya fue procesada.");

    const deletedUsers = await tx.$executeRaw`
      DELETE FROM "User"
      WHERE "id" = ${approval.targetUserId} AND "deletionScheduledAt" <= NOW() AND "isSuperAdmin" = false
    `;
    if (deletedUsers === 0) throw new Error("La cuenta ya no está disponible para eliminación definitiva.");
  });

  await recordAdminAudit({ actorUserId, targetUserId: approval.targetUserId, targetEmail: approval.targetEmail, action: "USER_DELETED_PERMANENTLY", detail: `Usuario eliminado definitivamente después de vencer el periodo de gracia. Motivo: ${approval.reason}`, metadata: { approvalId, reason: approval.reason }, ...context });

  return { targetEmail: approval.targetEmail, reason: approval.reason };
}

export async function listScheduledAdminDeletions() {
  const rows = await prisma.$queryRaw<Array<{ id: string; targetUserId: string; targetEmail: string; reason: string; deletionScheduledAt: Date }>>`
    SELECT approvals."id", approvals."targetUserId", approvals."targetEmail", approvals."reason", target."deletionScheduledAt"
    FROM "admin_deletion_approvals" AS approvals
    INNER JOIN "User" AS target ON target."id" = approvals."targetUserId"
    WHERE approvals."status" = 'SCHEDULED' AND target."deletionScheduledAt" IS NOT NULL
    ORDER BY target."deletionScheduledAt" ASC
  `;
  return rows.map((row) => ({ ...row, deletionScheduledAt: row.deletionScheduledAt.toISOString() }));
}

export async function notifyDueAdminDeletions() {
  const dueDeletions = await prisma.$queryRaw<Array<{ id: string; targetEmail: string; reason: string }>>`
    SELECT approvals."id", approvals."targetEmail", approvals."reason"
    FROM "admin_deletion_approvals" AS approvals
    INNER JOIN "User" AS target ON target."id" = approvals."targetUserId"
    WHERE approvals."status" = 'SCHEDULED'
      AND target."deletionScheduledAt" <= NOW()
      AND approvals."deletionReminderSentAt" IS NULL
    ORDER BY target."deletionScheduledAt" ASC
    LIMIT 100
  `;

  let sent = 0;
  let failed = 0;

  for (const deletion of dueDeletions) {
    const reminderSentAt = new Date();
    const claimed = await prisma.$executeRaw`
      UPDATE "admin_deletion_approvals"
      SET "deletionReminderSentAt" = ${reminderSentAt}
      WHERE "id" = ${deletion.id}
        AND "status" = 'SCHEDULED'
        AND "deletionReminderSentAt" IS NULL
    `;

    if (claimed !== 1) {
      continue;
    }

    const delivered = await notifyPrimaryAdminSecurityEvent({
      action: "USER_DELETION_READY",
      actorEmail: "Sistema de seguridad",
      targetEmail: deletion.targetEmail,
      detail: `La eliminación programada ya cumplió el periodo de gracia de 30 días. Motivo: ${deletion.reason}. Debe ejecutarse manualmente desde el panel con MFA.`,
    });

    if (delivered) {
      sent += 1;
      continue;
    }

    failed += 1;
    await prisma.$executeRaw`
      UPDATE "admin_deletion_approvals"
      SET "deletionReminderSentAt" = NULL
      WHERE "id" = ${deletion.id} AND "deletionReminderSentAt" = ${reminderSentAt}
    `;
  }

  return { checked: dueDeletions.length, sent, failed };
}

export async function rejectAdminUserDeletion(approvalId: string, approverUserId: string, context?: AdminActionContext) {
  const approvers = await prisma.$queryRaw<Array<{ email: string; status: string; role: string }>>`
    SELECT "email", "status", "role"
    FROM "User"
    WHERE "id" = ${approverUserId}
    LIMIT 1
  `;
  const approver = approvers[0];

  if (!approver || approver.status !== "ACTIVE" || approver.role !== "ADMIN") {
    throw new Error("El revisor debe ser un administrador activo.");
  }

  const approvals = await prisma.$queryRaw<ApprovalRow[]>`
    SELECT
      "id", "targetUserId", "targetEmail", "requestedById", NULL::text AS "requestedByEmail",
      "confirmationEmail", "reason", "status", "expiresAt", "createdAt"
    FROM "admin_deletion_approvals"
    WHERE "id" = ${approvalId}
    LIMIT 1
  `;
  const approval = approvals[0];

  if (!approval || approval.status !== "PENDING") {
    throw new Error("La solicitud ya no está pendiente.");
  }

  if (approval.requestedById === approverUserId) {
    throw new Error("La persona que solicita la eliminación no puede rechazarla.");
  }

  const updated = await prisma.$executeRaw`
    UPDATE "admin_deletion_approvals"
    SET "status" = 'REJECTED', "approvedById" = ${approverUserId}, "decidedAt" = NOW()
    WHERE "id" = ${approvalId} AND "status" = 'PENDING' AND "expiresAt" > NOW()
  `;

  if (updated === 0) {
    throw new Error("La solicitud expiró o ya fue procesada.");
  }

  await recordAdminAudit({
    actorUserId: approverUserId,
    targetUserId: approval.targetUserId,
    targetEmail: approval.targetEmail,
    action: "USER_DELETION_REJECTED",
    detail: `Solicitud de eliminación permanente rechazada. Motivo original: ${approval.reason}`,
    metadata: { approvalId, requestedById: approval.requestedById },
    ...context,
  });
}
