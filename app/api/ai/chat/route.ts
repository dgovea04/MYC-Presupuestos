import { NextResponse } from "next/server";
import { executeAiTask } from "@/lib/ai/gateway/execute";
import { attachProjectHistoryEntry } from "@/lib/ai/project-history-route";
import { withAiRoute } from "@/lib/ai/route-handler";
import { aiChatRequestSchema } from "@/lib/ai/validation";

export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    const data = aiChatRequestSchema.parse(await request.json());
    const result = await executeAiTask({
      provider: data.provider,
      task: "chat",
      payload: {
        message: data.message,
        context: data.context,
      },
      projectId: data.projectId,
      userId: session.user.id,
    });

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
  });
}
