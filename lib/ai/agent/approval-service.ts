import { prisma } from "@/lib/db/prisma";
import type {
  AgentApprovalService,
  ApprovalActionParams,
  ApprovalActionResult,
  ApprovalStatusParams,
  ApprovalStatusResult,
} from "./contracts";
import type { AgentExecutionState } from "./types";

/**
 * Implementación concreta del Approval Service.
 *
 * Todas las lecturas y mutaciones de aprobación se acotan a la ejecución
 * propiedad del usuario actor para evitar acceso horizontal por ID.
 */
export class AgentApprovalServiceImpl implements AgentApprovalService {
  async approve(params: ApprovalActionParams): Promise<ApprovalActionResult> {
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const approval = await tx.agentApproval.findFirst({
        where: {
          id: params.approvalId,
          execution: { userId: params.userId },
        },
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

      const updated = await tx.agentApproval.updateMany({
        where: {
          id: params.approvalId,
          decision: null,
          execution: { userId: params.userId },
        },
        data: {
          decision: "approve",
          reason: params.reason ?? null,
          decidedAt: now,
          decidedByUserId: params.userId,
        },
      });

      if (updated.count !== 1) {
        throw new Error(`Aprobación "${params.approvalId}" ya fue decidida.`);
      }

      const validTransitions: AgentExecutionState[] = ["PENDING_APPROVAL"];
      if (validTransitions.includes(approval.execution.state as AgentExecutionState)) {
        await tx.agentExecution.updateMany({
          where: { id: approval.executionId, userId: params.userId },
          data: { state: "EXECUTING", updatedAt: now },
        });
      }
    });

    const approval = await prisma.agentApproval.findFirstOrThrow({
      where: {
        id: params.approvalId,
        execution: { userId: params.userId },
      },
      select: { executionId: true },
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
      const approval = await tx.agentApproval.findFirst({
        where: {
          id: params.approvalId,
          execution: { userId: params.userId },
        },
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

      const updated = await tx.agentApproval.updateMany({
        where: {
          id: params.approvalId,
          decision: null,
          execution: { userId: params.userId },
        },
        data: {
          decision: "reject",
          reason: params.reason ?? "Rechazado por el usuario.",
          decidedAt: now,
          decidedByUserId: params.userId,
        },
      });

      if (updated.count !== 1) {
        throw new Error(`Aprobación "${params.approvalId}" ya fue decidida.`);
      }

      await tx.agentExecution.updateMany({
        where: { id: approval.executionId, userId: params.userId },
        data: {
          state: "FAILED",
          summary: `Ejecución rechazada: ${params.reason ?? "Sin motivo especificado."}`,
          finishedAt: now,
          updatedAt: now,
        },
      });
    });

    const approval = await prisma.agentApproval.findFirstOrThrow({
      where: {
        id: params.approvalId,
        execution: { userId: params.userId },
      },
      select: { executionId: true },
    });

    return {
      approved: false,
      executionId: approval.executionId,
      newState: "FAILED",
    };
  }

  async getStatus(params: ApprovalStatusParams): Promise<ApprovalStatusResult> {
    const approval = await prisma.agentApproval.findFirst({
      where: {
        id: params.approvalId,
        execution: { userId: params.userId },
      },
    });

    if (!approval) {
      throw new Error(`Aprobación "${params.approvalId}" no encontrada.`);
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
