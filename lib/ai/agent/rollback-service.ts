import { prisma } from "@/lib/db/prisma";
import type {
  AgentRollbackService,
  RollbackParams,
  RollbackResult,
} from "./contracts";
import type { AgentExecutionState } from "./types";

/**
 * Rollback Service — revierte una ejecución o step agentico.
 *
 * Responsabilidades:
 * - Buscar la ejecución y step correspondiente
 * - Registrar el rollback en la tabla AgentRollback con input/output
 * - Actualizar el estado de la ejecución a ROLLED_BACK
 * - Auditar fallos de rollback sin ocultar el error original
 *
 * Reglas:
 * - Solo se puede hacer rollback si la ejecución está en EXECUTED o FAILED
 * - Rollback exitoso: estado → ROLLED_BACK
 * - Rollback fallido: se audita, la ejecución permanece en su estado actual
 * - Nunca se oculta un fallo original por un fallo de rollback
 */
export class AgentRollbackServiceImpl implements AgentRollbackService {
  async rollback(params: RollbackParams): Promise<RollbackResult> {
    const { executionId, stepId, userId, reason } = params;
    const now = new Date();

    // 1. Validar que la ejecución exista
    const execution = await prisma.agentExecution.findUnique({
      where: { id: executionId },
      include: {
        steps: stepId
          ? { where: { id: stepId } }
          : { orderBy: { sequence: "asc" } },
        toolInvocations: {
          where: stepId ? { stepId } : undefined,
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!execution) {
      return {
        success: false,
        rollbackId: "",
        errorMessage: `Ejecución "${executionId}" no encontrada.`,
      };
    }

    // 2. Validar que el estado permita rollback
    const validStates: AgentExecutionState[] = ["EXECUTED", "FAILED"];
    if (!validStates.includes(execution.state as AgentExecutionState)) {
      return {
        success: false,
        rollbackId: "",
        errorMessage: `La ejecución está en estado "${execution.state}" y no puede revertirse. Solo se permite rollback desde EXECUTED o FAILED.`,
      };
    }

    // 3. Validar step si se especificó
    if (stepId && execution.steps.length === 0) {
      return {
        success: false,
        rollbackId: "",
        errorMessage: `Step "${stepId}" no encontrado en la ejecución "${executionId}".`,
      };
    }

    // 4. Construir el payload de rollback
    const applicableInvocations = execution.toolInvocations.filter(
      (ti) => !stepId || ti.stepId === stepId,
    );

    const rollbackInputJson = {
      originalExecutionId: executionId,
      stepId: stepId ?? null,
      reason,
      affectedToolCalls: applicableInvocations.map((ti) => ({
        toolName: ti.toolName,
        arguments: ti.argumentsJson,
        result: ti.resultJson,
        success: ti.success,
      })),
      totalToolCalls: applicableInvocations.length,
      rolledBackBy: userId,
    };

    try {
      // 5. Persistir el rollback y actualizar estado en transacción
      const rollback = await prisma.$transaction(async (tx) => {
        // Obtener toolName para el registro (del primer invocation o genérico)
        const rollbackToolName =
          applicableInvocations.length > 0
            ? applicableInvocations[0].toolName
            : "rollback";

        const created = await tx.agentRollback.create({
          data: {
            executionId,
            stepId: stepId ?? null,
            rollbackToolName,
            rollbackInputJson,
            rollbackResultJson: { success: true, rolledBackAt: now.toISOString() },
            success: true,
            reason,
            createdByUserId: userId,
          },
        });

        // Actualizar estado de la ejecución
        const targetState: AgentExecutionState = "ROLLED_BACK";
        await tx.agentExecution.update({
          where: { id: executionId },
          data: {
            state: targetState,
            summary: `Ejecución revertida: ${reason}`,
            finishedAt: now,
            updatedAt: now,
          },
        });

        return created;
      });

      return {
        success: true,
        rollbackId: rollback.id,
      };
    } catch (error) {
      // 6. Error de rollback — auditar pero no ocultar
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Error desconocido durante rollback.";

      // Intentar registrar el rollback fallido
      try {
        await prisma.agentRollback.create({
          data: {
            executionId,
            stepId: stepId ?? null,
            rollbackToolName: "rollback",
            rollbackInputJson,
            rollbackResultJson: { success: false, error: errorMsg },
            success: false,
            errorMessage: errorMsg,
            reason,
            createdByUserId: userId,
          },
        });
      } catch {
        // Si ni siquiera podemos registrar el rollback, continuar con el error original
      }

      return {
        success: false,
        rollbackId: "",
        errorMessage: errorMsg,
      };
    }
  }

  supportsRollback(toolName: string): boolean {
    // Por ahora, todas las herramientas de escritura y financieras soportan rollback.
    // En fases posteriores, esto se puede refinar consultando el ToolRegistry
    // u otras fuentes de verdad.
    const writeTools = [
      "createBudget",
      "createChapter",
      "moveChapter",
      "deleteChapter",
      "addPartida",
      "removePartida",
      "addInsumo",
      "replaceInsumo",
      "updatePrecio",
      "createAPU",
      "updateAPU",
      "createSchedule",
      "updateTask",
      "moveTask",
      "createTakeoff",
      "archiveBudget",
      "cloneBudget",
      "generateBudget",
      "duplicatePartida",
      "reorderPartidas",
      "importTakeoff",
      "linkPredecessor",
    ];

    return writeTools.includes(toolName);
  }
}

/** Crea una instancia del Rollback Service. */
export function createRollbackService(): AgentRollbackService {
  return new AgentRollbackServiceImpl();
}
