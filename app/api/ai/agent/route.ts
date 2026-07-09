import { prisma } from "@/lib/db/prisma";
import { withAiRoute } from "@/lib/ai/route-handler";
import { aiAgentRequestSchema } from "@/lib/ai/agent/validation";
import { getWorkflowBySlug } from "@/lib/data/agent-workflows";
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

    // Inicializar machinery compartida
    const policyEngine = createPolicyEngine();
    const adapter = createVercelSdkAdapter();
    const planner = createPlanner();
    const approvalService = createApprovalService();

    let mode = data.mode ?? "chat";
    let message = data.message;

    // Si se especifica un workflow, cargar su plantilla
    if (data.workflowId) {
      const workflow = await getWorkflowBySlug(data.workflowId);
      if (!workflow) {
        return Response.json(
          { error: `Workflow "${data.workflowId}" no encontrado.` },
          { status: 404 },
        );
      }

      // Usar el goal template del workflow si no hay mensaje explícito del usuario
      if (!data.message || data.message.trim().length === 0) {
        message = workflow.initialGoalTemplate;
      }

      mode = workflow.defaultMode as typeof mode;

      // Filtrar herramientas si el workflow las restringe
      const rawTools = workflow.allowedToolsJson;
      const allowedTools: string[] = Array.isArray(rawTools) ? (rawTools as string[]) : [];

      if (allowedTools.length > 0) {
        const filteredTools = allTools.filter((t) => allowedTools.includes(t.name));
        const restrictedRegistry = createToolRegistry();
        for (const tool of filteredTools) {
          restrictedRegistry.register(tool);
        }

        const restrictedExecutor = createToolExecutor(restrictedRegistry, policyEngine);
        const restrictedOrchestrator = createAgentOrchestrator(
          planner,
          policyEngine,
          restrictedRegistry,
          restrictedExecutor,
          adapter,
          undefined,
        );

        const result = await restrictedOrchestrator.run({
          userId,
          projectId: data.projectId,
          message,
          mode,
          workflowId: data.workflowId,
          executionId: data.executionId,
        });

        return Response.json(result, { status: 200 });
      }
    }

    // Inicializar machinery con todas las herramientas (sin restricción de workflow)
    const registry = createToolRegistry();
    for (const tool of allTools) {
      registry.register(tool);
    }

    const toolExecutor = createToolExecutor(registry, policyEngine);
    const orchestrator = createAgentOrchestrator(
      planner,
      policyEngine,
      registry,
      toolExecutor,
      adapter,
      undefined,
    );

    const result = await orchestrator.run({
      userId,
      projectId: data.projectId,
      message,
      mode,
      workflowId: data.workflowId,
      executionId: data.executionId,
    });

    return Response.json(result, { status: 200 });
  });
}
