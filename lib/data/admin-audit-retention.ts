import { prisma } from "@/lib/db/prisma";
import { recordAdminAudit, type AdminAuditInput } from "@/lib/data/admin-audit";

export const ADMIN_AUDIT_RETENTION_DAYS = 90;

type AdminActionContext = Pick<AdminAuditInput, "ipAddress" | "userAgent">;

export function getAdminAuditRetentionCutoff(now = new Date()) {
  return new Date(now.getTime() - ADMIN_AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export async function anonymizeAdminAuditLogsBefore(input: {
  actorUserId: string;
  actorEmail: string;
  now?: Date;
  context?: AdminActionContext;
}) {
  const cutoff = getAdminAuditRetentionCutoff(input.now);
  const anonymizedRows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "admin_audit_logs"
    SET
      "actorUserId" = NULL,
      "targetUserId" = NULL,
      "targetEmail" = 'anonimizado-' || LEFT("id", 12),
      "detail" = 'Datos personales anonimizados por política de retención.',
      "metadata" = NULL,
      "ipAddress" = NULL,
      "userAgent" = NULL
    WHERE "createdAt" < ${cutoff}
      AND "targetEmail" NOT LIKE 'anonimizado-%'
    RETURNING "id"
  `;

  await recordAdminAudit({
    actorUserId: input.actorUserId,
    targetUserId: null,
    targetEmail: input.actorEmail,
    action: "AUDIT_RETENTION_ANONYMIZED",
    detail: `Se anonimizaron ${anonymizedRows.length} registros administrativos con más de ${ADMIN_AUDIT_RETENTION_DAYS} días.`,
    metadata: {
      anonymizedCount: anonymizedRows.length,
      retentionDays: ADMIN_AUDIT_RETENTION_DAYS,
      cutoff: cutoff.toISOString(),
    },
    ...input.context,
  });

  return {
    anonymizedCount: anonymizedRows.length,
    cutoff,
  };
}
