import { prisma } from "@/lib/db/prisma";
import { restoreBudgetVersionSnapshot } from "@/lib/collaboration/versions";
import { resolveBudgetOwnership } from "@/lib/collaboration/authorization";
export type RollbackResult = { sessionId: string; status: "ROLLED_BACK"; snapshotId: string };
export async function rollbackIntegrationSession(input: { sessionId: string; budgetId: string; userId: string; requestId: string }): Promise<RollbackResult> {
  await resolveBudgetOwnership(input.budgetId, input.userId);
  const session = await prisma.integrationSession.findFirst({ where: { id: input.sessionId, budgetId: input.budgetId, createdById: input.userId } });
  if (!session || !session.snapshotId) throw new Error("La sesión no tiene snapshot para rollback");
  if (session.status === "ROLLED_BACK") return { sessionId: session.id, status: "ROLLED_BACK", snapshotId: session.snapshotId };
  if (session.status !== "APPLIED") throw new Error("Solo se puede revertir una sesión aplicada");
  await restoreBudgetVersionSnapshot(session.snapshotId, session.budgetId, input.userId);
  await prisma.integrationSession.update({ where: { id: session.id }, data: { status: "ROLLED_BACK", rolledBackAt: new Date(), result: { rollbackRequestId: input.requestId } } });
  return { sessionId: session.id, status: "ROLLED_BACK", snapshotId: session.snapshotId };
}
