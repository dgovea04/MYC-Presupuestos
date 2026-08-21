import { prisma } from "@/lib/db/prisma";

/** Retención inicial propuesta en la especificación: 24 meses. */
export const WORKSPACE_AUDIT_RETENTION_MONTHS = 24;

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export function getWorkspaceAuditRetentionCutoff(now = new Date()) {
  return new Date(now.getTime() - WORKSPACE_AUDIT_RETENTION_MONTHS * MONTH_MS);
}

/**
 * Elimina eventos de auditoría de workspace anteriores al corte de retención.
 * El corte está suficientemente lejos (24 meses) para no borrar eventos
 * recientes de forma silenciosa.
 */
export async function purgeWorkspaceAuditEventsBefore(input: { now?: Date } = {}) {
  const cutoff = getWorkspaceAuditRetentionCutoff(input.now);
  const result = await prisma.workspaceAuditEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return { purgedCount: result.count, cutoff };
}
