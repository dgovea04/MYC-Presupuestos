import { prisma } from "@/lib/db/prisma";
import { withAiRoute } from "@/lib/ai/route-handler";
import { aiAgentRequestSchema } from "@/lib/ai/agent/validation";
import { createAgentOrchestrator } from "@/lib/ai/agent/orchestrator";
import { createPlanner } from "@/lib/ai/agent/planner";
import { createToolRegistry } from "@/lib/ai/agent/tool-registry";
import { allTools } from "@/lib/ai/agent/tools";
import { createPolicyEngine } from "@/lib/ai/agent/policy-engine";
import { createToolExecutor } from "@/lib/ai/agent/tool-executor";
import { createVercelSdkAdapter } from "@/lib/ai/agent/vercel-sdk-adapter";
import { createApprovalService } from "@/lib/ai/agent/approval-service";
import type { AgentExecutionState } from "@/lib/ai/agent/types";

/**
 * POST /api/ai/agent
 *
 * Inicia o continúa una ejecución agéntica.
 *
 * Body: { message, projectId?, mode?, executionId? }
 *
 * El orchestrator interpreta el objetivo, arma un plan, y
 * ejecuta herramientas autorizadas. Si una herramienta requiere
 * aprobación, la ejecución se pausa y retorna el approvalId
 * para que el usuario decida.
 */
export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    const data = aiAgentRequestSchema.parse(await request.json());
    const userId = session.user.id;

    // Si es una reanudación, continuar desde el executionId
    if (data.executionId) {
      const existing = await prisma.agentExecution.findUnique({
        where: { id: data.executionId },
      });

      if (!existing || existing.userId !== userId) {
        return Response.json(
          { error: "Ejecución no encontrada o no autorizada." },
          { status: 404 },
        );
      }

      const validResumeStates: AgentExecutionState[] = [
        "PENDING_APPROVAL",
        "EXECUTING",
      ];

      if (!validResumeStates.includes(existing.state as AgentExecutionState)) {
        return Response.json(
          {
            error: `La ejecución está en estado "${existing.state}" y no puede reanudarse.`,
            executionId: existing.id,
            state: existing.state,
          },
          { status: 409 },
        );
      }
    }

    // Inicializar machinery agéntica
    const registry = createToolRegistry();
    for (const tool of allTools) {
      registry.register(tool);
    }

    const policyEngine = createPolicyEngine();
    const toolExecutor = createToolExecutor(registry, policyEngine);
    const adapter = createVercelSdkAdapter();
    const planner = createPlanner();
    const approvalService = createApprovalService();

    const orchestrator = createAgentOrchestrator(
      planner,
      registry,
      policyEngine,
      toolExecutor,
      adapter,
      approvalService,
    );

    const mode = data.mode ?? "chat";

    const result = await orchestrator.run({
      userId,
      projectId: data.projectId,
      message: data.message,
      mode,
      workflowId: data.workflowId,
      executionId: data.executionId,
    });

    return Response.json(result, { status: 200 });
  });
}
