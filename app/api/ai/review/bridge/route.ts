import { NextResponse } from "next/server";
import { attachProjectHistoryEntry } from "@/lib/ai/project-history-route";
import { withAiRoute } from "@/lib/ai/route-handler";
import { aiBridgeReviewPersistRequestSchema } from "@/lib/ai/validation";

export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    const data = aiBridgeReviewPersistRequestSchema.parse(await request.json());

    return NextResponse.json(
      await attachProjectHistoryEntry({
        action: "review",
        context: data.context,
        projectId: data.projectId,
        result: {
          ...data.result,
          provider: data.result.provider ?? "chatgpt_bridge",
          task: data.result.task ?? "review_budget",
        },
        summary: data.budgetSummary.slice(0, 140),
        userId: session.user.id,
      }),
    );
  });
}
