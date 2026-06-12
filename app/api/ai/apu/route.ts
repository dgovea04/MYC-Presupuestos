import { NextResponse } from "next/server";
import { executeAiTask } from "@/lib/ai/gateway/execute";
import { attachProjectHistoryEntry } from "@/lib/ai/project-history-route";
import { withAiRoute } from "@/lib/ai/route-handler";
import { aiApuRequestSchema } from "@/lib/ai/validation";

export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    const data = aiApuRequestSchema.parse(await request.json());
    const result = await executeAiTask({
      provider: data.provider,
      task: "generate_apu",
      payload: {
        description: data.description,
        unit: data.unit,
        context: data.context,
      },
      projectId: data.projectId,
      userId: session.user.id,
    });

    return NextResponse.json(
      await attachProjectHistoryEntry({
        action: "apu",
        context: data.context,
        projectId: data.projectId,
        result,
        summary: data.description,
        userId: session.user.id,
      }),
    );
  });
}
