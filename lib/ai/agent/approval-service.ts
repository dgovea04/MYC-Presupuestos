import { prisma } from "@/lib/db/prisma";
import type {
  AgentApprovalService,
  ApprovalActionParams,
  ApprovalActionResult,
  ApprovalStatusResult,
} from "./contracts";
import type { AgentExecutionState } from "./types";

/**
 * Implementación concreta del Approval Service.
 *
 * Persiste aprobaciones en Prisma (modelo AgentApproval) y actualiza
 * el estado de la ejecución según la decisión del usuario.
 */
export class AgentApprovalServiceImpl implements AgentApprovalService {
  async approve(params: ApprovalActionParams): Promise<ApprovalActionResult> {
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const approval = await tx.agentApproval.findUnique({
        where: { id: params.approvalId },
        include: { execution: true },
      });

      if (!approval) {
        throw new Error(`Aprobación "${params.approvalId}" no encontrada.`);
      }

      if (approval.decision !== null) {
        throw new Error(
          `La aprobación "${params.approvalId}" ya fue decidida (${approval.decision}).`,
        );
      }

      await tx.agentApproval.update({
        where: { id: params.approvalId },
        data: {
          decision: "approve",
          reason: params.reason ?? null,
          decidedAt: now,
          decidedByUserId: params.userId,
        },
      });

      // Transicionar ejecución a EXECUTING para continuar
      const validTransitions: AgentExecutionState[] = [
        "PENDING_APPROVAL",
      ];

      if (validTransitions.includes(approval.execution.state as AgentExecutionState)) {
        await tx.agentExecution.update({
          where: { id: approval.executionId },
          data: { state: "EXECUTING", updatedAt: now },
        });
      }
    });

    const approval = await prisma.agentApproval.findUniqueOrThrow({
      where: { id: params.approvalId },
    });

    return {
      approved: true,
      executionId: approval.executionId,
      newState: "EXECUTING",
    };
  }

  async reject(params: ApprovalActionParams): Promise<ApprovalActionResult> {
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const approval = await tx.agentApproval.findUnique({
        where: { id: params.approvalId },
        include: { execution: true },
      });

      if (!approval) {
        throw new Error(`Aprobación "${params.approvalId}" no encontrada.`);
      }

      if (approval.decision !== null) {
        throw new Error(
          `La aprobación "${params.approvalId}" ya fue decidida (${approval.decision}).`,
        );
      }

      await tx.agentApproval.update({
        where: { id: params.approvalId },
        data: {
          decision: "reject",
          reason: params.reason ?? "Rechazado por el usuario.",
          decidedAt: now,
          decidedByUserId: params.userId,
        },
      });

      await tx.agentExecution.update({
        where: { id: approval.executionId },
        data: {
          state: "FAILED",
          summary: `Ejecución rechazada: ${params.reason ?? "Sin motivo especificado."}`,
          finishedAt: now,
          updatedAt: now,
        },
      });
    });

    const approval = await prisma.agentApproval.findUniqueOrThrow({
      where: { id: params.approvalId },
    });

    return {
      approved: false,
      executionId: approval.executionId,
      newState: "FAILED",
    };
  }

  async getStatus(approvalId: string): Promise<ApprovalStatusResult> {
    const approval = await prisma.agentApproval.findUnique({
      where: { id: approvalId },
    });

    if (!approval) {
      throw new Error(`Aprobación "${approvalId}" no encontrada.`);
    }

    return {
      approvalId: approval.id,
      executionId: approval.executionId,
      decision:
        approval.decision === "approve"
          ? "approve"
          : approval.decision === "reject"
            ? "reject"
            : "pending",
      reason: approval.reason ?? undefined,
      decidedByUserId: approval.decidedByUserId ?? undefined,
      decidedAt: approval.decidedAt ?? undefined,
      requestedAt: approval.requestedAt,
    };
  }
}

/** Crea una instancia del Approval Service. */
export function createApprovalService(): AgentApprovalService {
  return new AgentApprovalServiceImpl();
}
