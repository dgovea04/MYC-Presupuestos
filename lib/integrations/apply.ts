import { prisma } from "@/lib/db/prisma";
import { createBudgetVersionSnapshot } from "@/lib/collaboration/versions";
import { appendBudgetChangeEvent } from "@/lib/collaboration/events";

type IntegrationUpdate = { id: string; description?: string; unit?: string; quantity?: string; unitPrice?: string };
type IntegrationPayload = { updates?: IntegrationUpdate[] };
export type IntegrationApplyResult = { sessionId: string; status: "APPLIED"; snapshotId: string | null; appliedCount: number };

export async function applyIntegrationSession(input: { sessionId: string; userId: string; confirmationToken: string; expectedVersion: number; requestId: string }): Promise<IntegrationApplyResult> {
  const session = await prisma.integrationSession.findFirst({ where: { id: input.sessionId, createdById: input.userId }, include: { conflicts: { where: { resolved: false } } } });
  if (!session) throw new Error("Sesión de integración no encontrada");
  if (session.status === "APPLIED") return { sessionId: session.id, status: "APPLIED", snapshotId: session.snapshotId, appliedCount: Number((session.result as { appliedCount?: number } | null)?.appliedCount ?? 0) };
  if (session.status !== "CONFIRMED") throw new Error("La sesión no está confirmada");
  if (session.confirmationToken !== input.confirmationToken) throw new Error("Token de confirmación inválido");
  if (session.conflicts.length > 0) throw new Error("La sesión tiene conflictos sin resolver");
  const budget = await prisma.budget.findUnique({ where: { id: session.budgetId }, select: { id: true, updatedAt: true } });
  if (!budget || Math.floor(budget.updatedAt.getTime() / 1000) !== input.expectedVersion) throw new Error("La versión del presupuesto cambió; actualiza la preview");
  const snapshot = await createBudgetVersionSnapshot(session.budgetId, input.userId, `Antes de integración ${session.id}`, "Snapshot automático de integración");
  const payload = (session.stagedPayload ?? {}) as IntegrationPayload;
  const updates = payload.updates ?? [];
  let appliedCount = 0;
  await prisma.$transaction(async (tx) => {
    for (const update of updates) {
      const existing = await tx.budgetItem.findFirst({ where: { id: update.id, budgetId: session.budgetId }, select: { id: true, description: true, unit: true, quantity: true, unitPrice: true } });
      if (!existing) throw new Error(`La partida ${update.id} no pertenece al presupuesto`);
      await tx.budgetItem.update({ where: { id: existing.id }, data: { ...(update.description !== undefined ? { description: update.description } : {}), ...(update.unit !== undefined ? { unit: update.unit } : {}), ...(update.quantity !== undefined ? { quantity: update.quantity } : {}), ...(update.unitPrice !== undefined ? { unitPrice: update.unitPrice } : {}) } });
      appliedCount += 1;
    }
    await tx.integrationSession.update({ where: { id: session.id }, data: { status: "APPLIED", snapshotId: snapshot.id, appliedAt: new Date(), result: { appliedCount, requestId: input.requestId } } });
  });
  for (const update of updates) await appendBudgetChangeEvent({ budgetId: session.budgetId, userId: input.userId, entityType: "BUDGET_ITEM", entityId: update.id, action: "INTEGRATION_APPLIED", field: "budgetItem", oldValue: null, newValue: null, source: "SYSTEM", requestId: `${input.requestId}:${update.id}` });
  return { sessionId: session.id, status: "APPLIED", snapshotId: snapshot.id, appliedCount };
}
