import { prisma } from "@/lib/db/prisma";
import { companySchema } from "@/lib/validations/company";
import { recordWorkspaceAudit } from "@/lib/workspace/audit";
import { requireWorkspaceOwner, requireWorkspaceRole } from "@/lib/workspace/authorization";

export const WORKSPACE_DELETION_RECOVERY_DAYS = 30;

export function getWorkspaceDeletionRecoveryCutoff(now = new Date()) {
  return new Date(now.getTime() - WORKSPACE_DELETION_RECOVERY_DAYS * 24 * 60 * 60 * 1000);
}

export async function updateWorkspaceSettings(options: {
  companyId: string;
  actorUserId: string;
  name: string;
  ruc?: string | null;
  logoUrl?: string | null;
}) {
  await requireWorkspaceRole({ userId: options.actorUserId, companyId: options.companyId, minimumRole: "ADMIN" });
  const payload = companySchema.parse({ name: options.name, ruc: options.ruc ?? "" });
  const current = await prisma.company.findUnique({ where: { id: options.companyId }, select: { name: true, ruc: true, logoUrl: true } });
  if (!current) throw new Error("Workspace no encontrado");

  const company = await prisma.$transaction(async (tx) => {
    const updated = await tx.company.update({
      where: { id: options.companyId },
      data: { name: payload.name, ruc: payload.ruc ?? null, ...(options.logoUrl !== undefined ? { logoUrl: options.logoUrl } : {}) },
    });
    await recordWorkspaceAudit({
      companyId: options.companyId,
      actorUserId: options.actorUserId,
      action: "WORKSPACE_UPDATED",
      targetType: "WORKSPACE",
      targetId: options.companyId,
      targetLabel: updated.name,
      metadata: { before: current, after: { name: updated.name, ruc: updated.ruc, logoUrl: updated.logoUrl } },
    }, tx);
    return updated;
  });
  return company;
}

export async function deleteWorkspace(options: { companyId: string; actorUserId: string; confirmationName: string }) {
  await requireWorkspaceOwner({ userId: options.actorUserId, companyId: options.companyId });
  const company = await prisma.company.findUnique({
    where: { id: options.companyId },
    select: { id: true, name: true, deletedAt: true, subscription: { select: { status: true } } },
  });
  if (!company) throw new Error("Workspace no encontrado");
  if (company.deletedAt) throw new Error("El workspace ya fue eliminado");
  if (options.confirmationName.trim() !== company.name) throw new Error("La confirmación no coincide con el nombre del workspace");
  if (company.subscription && ["ACTIVE", "TRIALING", "PAST_DUE", "INCOMPLETE"].includes(company.subscription.status)) {
    throw new Error("Cancela o resuelve la suscripción antes de eliminar el workspace");
  }

  return prisma.$transaction(async (tx) => {
    const deleted = await tx.company.update({ where: { id: company.id }, data: { deletedAt: new Date() } });
    await recordWorkspaceAudit(
      {
        companyId: company.id,
        actorUserId: options.actorUserId,
        action: "WORKSPACE_DELETED",
        targetType: "WORKSPACE",
        targetId: company.id,
        targetLabel: company.name,
        metadata: { recoveryDays: WORKSPACE_DELETION_RECOVERY_DAYS, deletedAt: deleted.deletedAt?.toISOString() ?? null },
      },
      tx,
    );
    return { id: company.id, name: company.name, deletedAt: deleted.deletedAt };
  });
}

export async function restoreWorkspace(options: { companyId: string; actorUserId: string }) {
  const company = await prisma.company.findFirst({
    where: { id: options.companyId, deletedAt: { not: null } },
    select: { id: true, name: true, userId: true, deletedAt: true },
  });
  if (!company) throw new Error("El workspace no está pendiente de eliminación");
  if (company.userId !== options.actorUserId) throw new Error("Solo el Owner puede restaurar el workspace");
  if (company.deletedAt && company.deletedAt < getWorkspaceDeletionRecoveryCutoff()) {
    throw new Error("El período de recuperación del workspace expiró");
  }

  return prisma.$transaction(async (tx) => {
    await tx.company.update({ where: { id: company.id }, data: { deletedAt: null } });
    await recordWorkspaceAudit(
      {
        companyId: company.id,
        actorUserId: options.actorUserId,
        action: "WORKSPACE_RESTORED",
        targetType: "WORKSPACE",
        targetId: company.id,
        targetLabel: company.name,
      },
      tx,
    );
    return { id: company.id, name: company.name };
  });
}

export async function purgeDeletedWorkspacesBefore(input: { now?: Date } = {}) {
  const cutoff = getWorkspaceDeletionRecoveryCutoff(input.now);
  const result = await prisma.company.deleteMany({
    where: { deletedAt: { not: null, lt: cutoff } },
  });

  return { purgedCount: result.count, cutoff };
}
