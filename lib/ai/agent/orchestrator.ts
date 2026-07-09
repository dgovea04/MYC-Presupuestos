import crypto from "crypto";
import type { AgentExecutionState, AgentToolActivitySummary } from "./types";
import { transition } from "./state-machine";
import type {
  AgentOrchestrator,
  AgentOrchestratorOutput,
  AgentPlanner,
  AgentPolicyEngine,
  AgentToolRegistry,
  AgentToolExecutor,
  AgentVercelSdkAdapter,
  AgentLoopMessage,
} from "./contracts";
import type { RunAgentRequest, PlannedStep } from "./types";

/**
 * Agent Orchestrator — une state machine, planner, policy engine, tool registry,
 * tool executor y Vercel AI SDK adapter en un ciclo de ejecución completo.
 *
 * Ciclo de vida:
 *   READ → PLAN → PROPOSE → SIMULATE → PENDING_APPROVAL / EXECUTING → EXECUTED
 *
 * Dependencias inyectadas en el constructor (DI pattern).
 */
export class AgentOrchestratorImpl implements AgentOrchestrator {
  constructor(
    private readonly planner: AgentPlanner,
    private readonly policyEngine: AgentPolicyEngine,
    private readonly registry: AgentToolRegistry,
    private readonly toolExecutor: AgentToolExecutor,
    private readonly adapter: AgentVercelSdkAdapter,
    /** Modelo resuelto por el gateway (LanguageModel). */
    private readonly languageModel: unknown,
    /** Nombre del provider (para auditoría). */
    private readonly providerName: string = "openrouter",
  ) {}

  async run(request: RunAgentRequest): Promise<AgentOrchestratorOutput> {
    const executionId = request.executionId ?? crypto.randomUUID();
    const startTime = Date.now();
    const warnings: string[] = [];
    const toolActivity: AgentToolActivitySummary[] = [];

    let state: AgentExecutionState = "READ";
    let plan: PlannedStep[] = [];
    const completedSteps: PlannedStep[] = [];
    const failedSteps: PlannedStep[] = [];

    try {
      // ── 1. READ → PLAN ──────────────────────────────────────────────────
      state = transition(state, "PLAN");

      plan = await this.planner.plan({
        goal: request.message,
        projectId: request.projectId,
        userId: request.userId,
        mode: request.mode,
        workflowId: request.workflowId,
        availableTools: this.registry.getToolNames(),
      });

      if (plan.length === 0) {
        state = transition(state, "FAILED");
        return this.buildOutput(executionId, state, request.mode, plan, completedSteps, failedSteps, toolActivity, warnings, "No se pudo generar un plan para la solicitud.");
      }

      // ── 2. PLAN → PROPOSE ───────────────────────────────────────────────
      state = transition(state, "PROPOSE");

      // ── 3. PROPOSE → SIMULATE ───────────────────────────────────────────
      // TODO: en modo "goal", esperar confirmación del usuario antes de continuar
      state = transition(state, "SIMULATE");

      // ── 4. Evaluar pasos con boundary de aprobación ─────────────────────
      const approvalSteps = plan.filter((s) => s.approvalBoundary && s.toolName);
      if (approvalSteps.length > 0) {
        // Verificar si algún paso requiere aprobación según la política
        for (const step of approvalSteps) {
          const tool = this.registry.get(step.toolName!);
          if (!tool) continue;

          const policy = this.policyEngine.evaluate({
            toolName: step.toolName!,
            toolRisk: tool.risk,
            executionMode: request.mode,
            projectId: request.projectId,
            userId: request.userId,
            stepId: step.id,
          });

          if (policy.approvalRequirement !== "none") {
            state = transition(state, "PENDING_APPROVAL");
            return this.buildOutput(
              executionId,
              state,
              request.mode,
              plan,
              completedSteps,
              failedSteps,
              toolActivity,
              warnings,
              `Plan requiere aprobación para ejecutar "${step.toolName}".`,
              {
                approvalId: `approval_${executionId}_${step.id}`,
                stepId: step.id,
                reason: policy.policyReason,
              },
            );
          }
        }
      }

      // ── 5. SIMULATE → EXECUTING ─────────────────────────────────────────
      state = transition(state, "EXECUTING");

      // ── 6. Ejecutar pasos secuencialmente ───────────────────────────────
      const completedStepIds = new Set<string>();

      for (const step of plan) {
        // Verificar dependencias
        const unmetDeps = step.dependsOn.filter((depId) => !completedStepIds.has(depId));
        if (unmetDeps.length > 0) {
          failedSteps.push(step);
          warnings.push(`Paso "${step.title}" omitido: dependencias no satisfechas.`);
          continue;
        }

        try {
          // Ejecutar paso: llamar al modelo con el objetivo del paso
          const systemPrompt = buildStepSystemPrompt(step, request);
          const conversationMessages: AgentLoopMessage[] = [
            { role: "user", content: `Objetivo: ${step.objective}\n\nSolicitud original: ${request.message}` },
          ];

          const loopOutput = await this.adapter.runLoop({
            system: systemPrompt,
            messages: conversationMessages,
            tools: this.registry.toSdkDefinitions(),
            stopWhen: step.approvalBoundary ? "approval_boundary" : "final_text",
            provider: this.providerName,
            resolvedModel: this.languageModel,
          });

          // Procesar tool calls
          for (const toolCall of loopOutput.toolCalls) {
            const result = await this.toolExecutor.execute({
              toolCall,
              userId: request.userId,
              projectId: request.projectId,
              executionId,
              stepId: step.id,
              mode: request.mode,
            });

            toolActivity.push({
              toolName: toolCall.name,
              success: result.success,
              latencyMs: result.latencyMs,
              summary: result.summary,
            });

            if (result.approvalRequired) {
              state = transition(state, "PENDING_APPROVAL");
              return this.buildOutput(
                executionId,
                state,
                request.mode,
                plan,
                completedSteps,
                failedSteps,
                toolActivity,
                warnings,
                `Herramienta "${toolCall.name}" requiere aprobación durante paso "${step.title}".`,
                {
                  approvalId: result.approvalRequired.approvalId,
                  stepId: step.id,
                  reason: result.approvalRequired.reason,
                },
              );
            }

            if (!result.success) {
              warnings.push(`Herramienta "${toolCall.name}" falló: ${result.summary}`);
            }
          }

          completedSteps.push(step);
          completedStepIds.add(step.id);
        } catch (stepError) {
          failedSteps.push(step);
          const msg = stepError instanceof Error ? stepError.message : "Error desconocido";
          warnings.push(`Paso "${step.title}" falló: ${msg}`);
        }
      }

      // ── 7. EXECUTING → EXECUTED ─────────────────────────────────────────
      if (failedSteps.length === plan.length) {
        state = transition(state, "FAILED");
        return this.buildOutput(
          executionId, state, request.mode, plan, completedSteps, failedSteps, toolActivity, warnings,
          "Todos los pasos del plan fallaron.",
        );
      }

      state = transition(state, "EXECUTED");
      return this.buildOutput(
        executionId, state, request.mode, plan, completedSteps, failedSteps, toolActivity, warnings,
        `Plan completado: ${completedSteps.length}/${plan.length} pasos exitosos.`,
      );
    } catch (error) {
      // Error fatal en el orchestrator
      const msg = error instanceof Error ? error.message : "Error desconocido en el orchestrator.";
      warnings.push(msg);

      // Intentar transicionar a FAILED desde cualquier estado
      try {
        state = transition(state, "FAILED");
      } catch {
        state = "FAILED";
      }

      return this.buildOutput(executionId, state, request.mode, plan, completedSteps, failedSteps, toolActivity, warnings, msg);
    }
  }

  private buildOutput(
    executionId: string,
    state: AgentExecutionState,
    mode: RunAgentRequest["mode"],
    plan: PlannedStep[],
    completedSteps: PlannedStep[],
    failedSteps: PlannedStep[],
    toolActivity: AgentToolActivitySummary[],
    warnings: string[],
    summary: string,
    pendingApproval?: AgentOrchestratorOutput["pendingApproval"],
  ): AgentOrchestratorOutput {
    return {
      executionId,
      state,
      mode,
      summary,
      plan,
      completedSteps,
      failedSteps,
      pendingApproval,
      toolActivity,
      warnings,
    };
  }
}

/**
 * Factory function.
 */
export function createAgentOrchestrator(
  planner: AgentPlanner,
  policyEngine: AgentPolicyEngine,
  registry: AgentToolRegistry,
  toolExecutor: AgentToolExecutor,
  adapter: AgentVercelSdkAdapter,
  languageModel: unknown,
  providerName?: string,
): AgentOrchestratorImpl {
  return new AgentOrchestratorImpl(
    planner,
    policyEngine,
    registry,
    toolExecutor,
    adapter,
    languageModel,
    providerName,
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildStepSystemPrompt(
  step: PlannedStep,
  request: RunAgentRequest,
): string {
  const lines = [
    "Eres un asistente de construcción y presupuestos de obra en Perú.",
    "",
    `Objetivo del paso actual: ${step.objective}`,
    `Resultado esperado: ${step.expectedOutcome}`,
  ];

  if (request.projectId) {
    lines.push(`Proyecto: ${request.projectId}`);
  }

  if (step.toolName) {
    lines.push(`Herramienta sugerida: ${step.toolName}`);
  }

  if (step.dependsOn.length > 0) {
    lines.push(`Depende de pasos previos: ${step.dependsOn.join(", ")}`);
  }

  return lines.join("\n");
}
