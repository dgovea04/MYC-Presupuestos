import { NextResponse } from "next/server";
import { trackServerEvent } from "@/lib/analytics/events";
import { executeAiTask } from "@/lib/ai/gateway/execute";
import { attachProjectHistoryEntry } from "@/lib/ai/project-history-route";
import { withAiRoute } from "@/lib/ai/route-handler";
import { assertAiCapabilityAccess } from "@/lib/ai/route-access-matrix";
import { aiChatRequestSchema } from "@/lib/ai/validation";

export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    const data = aiChatRequestSchema.parse(await request.json());
    const workspaceId = data.workspaceId ?? session.user.activeCompanyId ?? session.user.companyId ?? null;
    if (workspaceId) await assertAiCapabilityAccess({ userId: session.user.id, workspaceId, capability: "chat" });
    const result = await executeAiTask({
      provider: data.provider,
      task: "chat",
      payload: {
        message: data.message,
        context: data.context,
      },
      projectId: data.projectId,
      userId: session.user.id,
      ...(workspaceId ? { workspaceId } : {}),
      ...(data.requestId ? { requestId: data.requestId } : {}),
    });
    void trackServerEvent("khipu_used", {
      userId: session.user.id,
      companyId: session.user.activeCompanyId ?? session.user.companyId,
      action_type: "chat",
      provider: data.provider,
    }).catch(() => undefined);

    return NextResponse.json(
      await attachProjectHistoryEntry({
        action: "chat",
        context: data.context,
        projectId: data.projectId,
        result,
        summary: data.message,
        userId: session.user.id,
      }),
    );
  }, { capability: "chat" });
}
