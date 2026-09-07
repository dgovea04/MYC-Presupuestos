import { prisma } from "@/lib/db/prisma";
import { restoreBudgetVersionSnapshot } from "@/lib/collaboration/versions";
export type RollbackResult = { sessionId: string; status: "ROLLED_BACK"; snapshotId: string };
export async function rollbackIntegrationSession(input: { sessionId: string; userId: string; requestId: string }): Promise<RollbackResult> {
  const session = await prisma.integrationSession.findFirst({ where: { id: input.sessionId, createdById: input.userId } });
  if (!session || !session.snapshotId) throw new Error("La sesión no tiene snapshot para rollback");
  if (session.status === "ROLLED_BACK") return { sessionId: session.id, status: "ROLLED_BACK", snapshotId: session.snapshotId };
  if (session.status !== "APPLIED") throw new Error("Solo se puede revertir una sesión aplicada");
  await restoreBudgetVersionSnapshot(session.snapshotId, session.budgetId, input.userId);
  await prisma.integrationSession.update({ where: { id: session.id }, data: { status: "ROLLED_BACK", rolledBackAt: new Date(), result: { rollbackRequestId: input.requestId } } });
  return { sessionId: session.id, status: "ROLLED_BACK", snapshotId: session.snapshotId };
}
