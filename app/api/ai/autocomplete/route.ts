import { NextResponse } from "next/server";
import { executeAiTask } from "@/lib/ai/gateway/execute";
import { attachProjectHistoryEntry } from "@/lib/ai/project-history-route";
import { withAiRoute } from "@/lib/ai/route-handler";
import { aiAutocompleteRequestSchema } from "@/lib/ai/validation";

export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    const data = aiAutocompleteRequestSchema.parse(await request.json());
    const result = await executeAiTask({
      provider: data.provider,
      task: "autocomplete",
      payload: {
        input: data.input,
        context: data.context,
      },
      projectId: data.projectId,
      userId: session.user.id,
    });

    return NextResponse.json(
      await attachProjectHistoryEntry({
        action: "autocomplete",
        context: data.context,
        projectId: data.projectId,
        result,
        summary: data.input,
        userId: session.user.id,
      }),
    );
  });
}
