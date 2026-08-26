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
import type { AgentExecutionState, AgentOrchestratorOutput } from "@/lib/ai/agent/types";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { assertAiCapabilityAccess } from "@/lib/ai/route-access-matrix";
import crypto from "node:crypto";
import { resolveAiCredential } from "@/lib/ai/credentials/resolver";
import { getEffectiveAiPolicy } from "@/lib/ai/credentials/policy-service";
import { isScopedAiResolverEnabled } from "@/lib/ai/credentials/rollout";
import { reserveAiUsage, recordScopedAiUsage, releaseAiUsage } from "@/lib/ai/usage-scope";
import { estimateAiTokens } from "@/lib/ai/service";

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
    await assertFeatureAccess({ userId, feature: "khipu.agent" });
    const workspaceId = data.workspaceId ?? session.user.activeCompanyId ?? session.user.companyId ?? null;
    if (workspaceId) {
      await assertAiCapabilityAccess({ userId, workspaceId, capability: "agent" });
      if (data.projectId) {
        const project = await prisma.project.findFirst({
          where: {
            id: data.projectId,
            companyId: workspaceId,
            company: { memberships: { some: { userId, status: "ACTIVE" } } },
          },
          select: { id: true },
        });
        if (!project) return Response.json({ error: "El proyecto no pertenece al workspace autorizado." }, { status: 404 });
      }
    }

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

    // Inicializar machinery compartida. La política scoped también gobierna
    // las tools de escritura, no solo la resolución de la API key.
    const effectivePolicy = workspaceId && isScopedAiResolverEnabled()
      ? await getEffectiveAiPolicy({ userId, workspaceId })
      : null;
    const policyEngine = createPolicyEngine({ allowAgentWrites: effectivePolicy?.allowAgentWrites ?? true });
    const adapter = createVercelSdkAdapter();
    const planner = createPlanner();

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

        const result = await runAgentWithScopedUsage({
          userId,
          workspaceId,
          message,
          requestId: data.requestId,
          run: () => restrictedOrchestrator.run({
            userId,
            ...(workspaceId ? { workspaceId } : {}),
            projectId: data.projectId,
            message,
            mode,
            workflowId: data.workflowId,
            executionId: data.executionId,
          }),
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

    const result = await runAgentWithScopedUsage({
      userId,
      workspaceId,
      message,
      requestId: data.requestId,
      run: () => orchestrator.run({
        userId,
        ...(workspaceId ? { workspaceId } : {}),
        projectId: data.projectId,
        message,
        mode,
        workflowId: data.workflowId,
        executionId: data.executionId,
      }),
    });

    return Response.json(result, { status: 200 });
  }, { capability: "agent" });
}

async function runAgentWithScopedUsage(input: {
  userId: string;
  workspaceId: string | null;
  message: string;
  requestId?: string;
  run: () => Promise<AgentOrchestratorOutput>;
}): Promise<AgentOrchestratorOutput> {
  if (!input.workspaceId || !isScopedAiResolverEnabled()) return input.run();

  const requestId = input.requestId ?? crypto.randomUUID();
  const credential = await resolveAiCredential({
    userId: input.userId,
    workspaceId: input.workspaceId,
    provider: "agent",
    task: "chat",
  });
  if (credential.billingScope === "PLATFORM") return input.run();

  const estimatedTokens = estimateAiTokens(input.message);
  const reservation = await reserveAiUsage({
    userId: input.userId,
    workspaceId: input.workspaceId,
    billingScope: credential.billingScope,
    estimatedTokens,
    allowance: credential.tokenLimit,
    budgetMinor: credential.budgetLimitMinor,
    provider: credential.provider,
    model: credential.model,
    action: "agent",
    credentialSource: credential.credentialSource,
    credentialId: credential.credentialId,
    requestId,
    hardLimit: credential.hardLimit,
    alertThresholds: credential.alertThresholds,
  });

  let settled = false;
  try {
    const result = await input.run();
    await recordScopedAiUsage({
      userId: input.userId,
      workspaceId: input.workspaceId,
      billingScope: credential.billingScope,
      credentialSource: credential.credentialSource,
      credentialId: credential.credentialId,
      requestId,
      provider: credential.provider,
      model: credential.model,
      action: "agent",
      estimatedTokens: reservation.estimatedTokens,
      actualTokens: estimateAiTokens(`${input.message}\n${result.summary}`),
      reservedCostMinor: reservation.estimatedCostMinor,
      periodStart: reservation.periodStart,
    });
    settled = true;
    return result;
  } finally {
    if (!settled) {
      await releaseAiUsage({
        userId: input.userId,
        workspaceId: input.workspaceId,
        billingScope: credential.billingScope,
        estimatedTokens: reservation.estimatedTokens,
        provider: credential.provider,
        model: credential.model,
        action: "agent",
        credentialSource: credential.credentialSource,
        credentialId: credential.credentialId,
        requestId,
        estimatedCostMinor: reservation.estimatedCostMinor,
        periodStart: reservation.periodStart,
      }).catch(() => undefined);
    }
  }
}
