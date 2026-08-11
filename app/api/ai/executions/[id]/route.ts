import { prisma } from "@/lib/db/prisma";
import { withAiRoute } from "@/lib/ai/route-handler";
import { assertFeatureAccess } from "@/lib/billing/entitlements";

/**
 * GET /api/ai/executions/[id]
 *
 * Devuelve el detalle completo de una ejecución agéntica,
 * incluyendo steps planificados, tool invocations, y aprobaciones.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAiRoute(async (session) => {
    await assertFeatureAccess({ userId: session.user.id, feature: "khipu.agent" });
    const { id } = await params;

    const execution = await prisma.agentExecution.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { sequence: "asc" },
          include: {
            toolInvocations: {
              orderBy: { createdAt: "asc" },
            },
            approvals: true,
          },
        },
        toolInvocations: {
          orderBy: { createdAt: "asc" },
        },
        approvals: {
          orderBy: { requestedAt: "asc" },
        },
        rollbacks: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!execution || execution.userId !== session.user.id) {
      return Response.json(
        { error: "Ejecución no encontrada o no autorizada." },
        { status: 404 },
      );
    }

    return Response.json(
      {
        execution: {
          id: execution.id,
          userId: execution.userId,
          projectId: execution.projectId,
          mode: execution.mode,
          state: execution.state,
          goal: execution.goal,
          summary: execution.summary,
          provider: execution.provider,
          model: execution.model,
          startedAt: execution.startedAt,
          finishedAt: execution.finishedAt,
          lastError: execution.lastError,
          contextSnapshot: execution.contextSnapshotJson,
          steps: execution.steps.map((step) => ({
            id: step.id,
            sequence: step.sequence,
            title: step.title,
            objective: step.objective,
            toolName: step.toolName,
            status: step.status,
            approvalRequired: step.approvalRequired,
            inputJson: step.inputJson,
            resultSummary: step.resultSummary,
            startedAt: step.startedAt,
            finishedAt: step.finishedAt,
            toolInvocations: step.toolInvocations.map((ti) => ({
              id: ti.id,
              toolName: ti.toolName,
              argumentsJson: ti.argumentsJson,
              resultJson: ti.resultJson,
              latencyMs: ti.latencyMs,
              success: ti.success,
              errorMessage: ti.errorMessage,
            })),
            approvals: step.approvals.map((a) => ({
              id: a.id,
              decision: a.decision,
              reason: a.reason,
              requestedAt: a.requestedAt,
              decidedAt: a.decidedAt,
            })),
          })),
          approvals: execution.approvals.map((a) => ({
            id: a.id,
            decision: a.decision,
            reason: a.reason,
            requestedAt: a.requestedAt,
            decidedAt: a.decidedAt,
            decidedByUserId: a.decidedByUserId,
          })),
          rollbacks: execution.rollbacks.map((r) => ({
            id: r.id,
            rollbackToolName: r.rollbackToolName,
            success: r.success,
            errorMessage: r.errorMessage,
            reason: r.reason,
            createdAt: r.createdAt,
          })),
        },
      },
      { status: 200 },
    );
  });
}
