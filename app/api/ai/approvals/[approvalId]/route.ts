import { createApprovalService } from "@/lib/ai/agent/approval-service";
import { withAiRoute } from "@/lib/ai/route-handler";

/**
 * GET /api/ai/approvals/[approvalId]
 *
 * Obtiene el estado detallado de una aprobación agéntica.
 * Incluye decisión, motivo, quién decidió y cuándo.
 *
 * Params:
 *   approvalId — ID de la aprobación a consultar
 *
 * Respuesta:
 *   { approval: { id, executionId, decision, reason, requestedAt, decidedAt, decidedByUserId } }
 *
 * Errores:
 *   404 — Aprobación no encontrada
 *   500 — Error interno al consultar
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ approvalId: string }> },
) {
  return withAiRoute(async (session) => {
    const { approvalId } = await params;

    try {
      const approvalService = createApprovalService();
      const status = await approvalService.getStatus({
        approvalId,
        userId: session.user.id,
      });

      return Response.json(
        {
          approval: {
            id: status.approvalId,
            executionId: status.executionId,
            decision: status.decision,
            reason: status.reason ?? null,
            requestedAt: status.requestedAt.toISOString(),
            decidedAt: status.decidedAt?.toISOString() ?? null,
            decidedByUserId: status.decidedByUserId ?? null,
          },
        },
        { status: 200 },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido al consultar la aprobación.";

      if (message.includes("no encontrada")) {
        return Response.json({ error: message }, { status: 404 });
      }

      return Response.json({ error: message }, { status: 500 });
    }
  });
}
