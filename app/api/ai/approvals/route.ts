import { createApprovalService } from "@/lib/ai/agent/approval-service";
import { aiApprovalRequestSchema } from "@/lib/ai/agent/validation";
import { withAiRoute } from "@/lib/ai/route-handler";

/**
 * POST /api/ai/approvals
 *
 * Aprueba o rechaza una ejecución agéntica que está pausada
 * esperando decisión humana.
 *
 * Body: { approvalId, decision: "approve" | "reject", reason? }
 */
export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    const data = aiApprovalRequestSchema.parse(await request.json());
    const approvalService = createApprovalService();

    if (data.decision === "approve") {
      const result = await approvalService.approve({
        approvalId: data.approvalId,
        userId: session.user.id,
        reason: data.reason,
      });
      return Response.json(result, { status: 200 });
    }

    const result = await approvalService.reject({
      approvalId: data.approvalId,
      userId: session.user.id,
      reason: data.reason,
    });
    return Response.json(result, { status: 200 });
  });
}
