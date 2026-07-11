import type {
  AgentToolCall,
  AgentToolResult,
} from "./types";
import type {
  AgentPolicyEngine,
  AgentToolExecutor,
  AgentToolRegistry,
  ToolExecutorInput,
  ToolExecutorOutput,
} from "./contracts";

/**
 * Tool Executor — único componente autorizado para invocar herramientas.
 *
 * Flujo:
 * 1. Busca la herramienta en el registry
 * 2. Valida input con Zod
 * 3. Consulta policy engine
 * 4. Si requiere aprobación, registra pausa
 * 5. Si está permitido, ejecuta
 * 6. Registra invocation y resumen
 * 7. Devuelve resultado estructurado
 */
export class ToolExecutor implements AgentToolExecutor {
  constructor(
    private readonly registry: AgentToolRegistry,
    private readonly policyEngine: AgentPolicyEngine,
  ) {}

  async execute(input: ToolExecutorInput): Promise<ToolExecutorOutput> {
    const { toolCall, userId, projectId, workspaceId, executionId, stepId, mode } = input;
    const startTime = Date.now();

    // 1. Buscar herramienta en registry
    const tool = this.registry.get(toolCall.name);
    if (!tool) {
      const latencyMs = Date.now() - startTime;
      return {
        toolResult: {
          toolCallId: toolCall.id,
          output: `Error: Herramienta "${toolCall.name}" no encontrada en el registry.`,
        },
        success: false,
        latencyMs,
        summary: `Tool "${toolCall.name}" no registrada.`,
      };
    }

    // 2. Validar input con Zod
    const parseResult = tool.inputSchema.safeParse(toolCall.arguments);
    if (!parseResult.success) {
      const latencyMs = Date.now() - startTime;
      const errorDetails = parseResult.error.issues
        .map((issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`)
        .join("\n  ");
      return {
        toolResult: {
          toolCallId: toolCall.id,
          output: `Error de validación:\n  ${errorDetails}`,
        },
        success: false,
        latencyMs,
        summary: `Tool "${toolCall.name}" recibió input inválido:\n  ${errorDetails}`,
      };
    }

    // 3. Validar que projectId esté presente si la tool lo requiere
    if (tool.requiresProjectId && !projectId) {
      const latencyMs = Date.now() - startTime;
      return {
        toolResult: {
          toolCallId: toolCall.id,
          output: `Error: La herramienta "${toolCall.name}" requiere un projectId.`,
        },
        success: false,
        latencyMs,
        summary: `Tool "${toolCall.name}" requiere projectId.`,
      };
    }

    // 4. Consultar policy engine
    const policy = this.policyEngine.evaluate({
      toolName: toolCall.name,
      toolRisk: tool.risk,
      executionMode: mode,
      projectId,
      userId,
      stepId,
    });

    if (!policy.allowed) {
      const latencyMs = Date.now() - startTime;
      return {
        toolResult: {
          toolCallId: toolCall.id,
          output: `Operación denegada: ${policy.policyReason}`,
        },
        success: false,
        latencyMs,
        summary: policy.policyReason,
      };
    }

    // 5. Si requiere aprobación, pausar (señalizar al orchestrator)
    if (policy.approvalRequirement !== "none") {
      const latencyMs = Date.now() - startTime;
      return {
        toolResult: {
          toolCallId: toolCall.id,
          output: `Aprobación pendiente: ${policy.policyReason}`,
        },
        success: false,
        approvalRequired: {
          approvalId: `approval_${executionId}_${toolCall.id}`,
          toolName: toolCall.name,
          reason: policy.policyReason,
        },
        latencyMs,
        summary: `Tool "${toolCall.name}" requiere aprobación.`,
      };
    }

    // 6. Ejecutar herramienta
    try {
      const validatedInput = parseResult.data;
      const result = await tool.execute(validatedInput, {
        userId,
        projectId,
        workspaceId,
        executionId,
        stepId,
        lastUserMessage: input.lastUserMessage,
        messages: input.messages,
      });

      const latencyMs = Date.now() - startTime;
      const summary = tool.summarizeResult
        ? tool.summarizeResult(result)
        : `Tool "${toolCall.name}" ejecutada exitosamente.`;

      return {
        toolResult: {
          toolCallId: toolCall.id,
          output: JSON.stringify(result),
        },
        success: true,
        latencyMs,
        summary,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : "Error desconocido en la herramienta.";
      return {
        toolResult: {
          toolCallId: toolCall.id,
          output: `Error: ${errorMsg}`,
        },
        success: false,
        latencyMs,
        summary: `Tool "${toolCall.name}" falló: ${errorMsg}`,
      };
    }
  }
}

/**
 * Factory function.
 */
export function createToolExecutor(
  registry: AgentToolRegistry,
  policyEngine: AgentPolicyEngine,
): ToolExecutor {
  return new ToolExecutor(registry, policyEngine);
}
