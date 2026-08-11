import { prisma } from "@/lib/db/prisma";
import { withAiRoute } from "@/lib/ai/route-handler";
import { assertFeatureAccess } from "@/lib/billing/entitlements";

/**
 * GET /api/ai/executions?projectId=<id>
 *
 * Lista ejecuciones agénticas del usuario autenticado,
 * filtrables por proyecto. Retorna información resumida
 * de cada ejecución (estado, plan, steps, tool calls).
 */
export async function GET(request: Request) {
  return withAiRoute(async (session) => {
    await assertFeatureAccess({ userId: session.user.id, feature: "khipu.agent" });
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId") ?? undefined;

    const where: Record<string, unknown> = {
      userId: session.user.id,
    };
    if (projectId) where.projectId = projectId;

    const executions = await prisma.agentExecution.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        _count: {
          select: {
            steps: true,
            toolInvocations: true,
            approvals: true,
          },
        },
      },
    });

    const list = executions.map((exec) => ({
      id: exec.id,
      mode: exec.mode,
      state: exec.state,
      goal: exec.goal,
      summary: exec.summary,
      provider: exec.provider,
      model: exec.model,
      startedAt: exec.startedAt,
      finishedAt: exec.finishedAt,
      lastError: exec.lastError,
      projectId: exec.projectId,
      stepCount: exec._count.steps,
      toolInvocationCount: exec._count.toolInvocations,
      pendingApprovals: exec._count.approvals,
    }));

    return Response.json({ executions: list }, { status: 200 });
  });
}
