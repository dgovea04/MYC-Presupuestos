import { NextResponse } from "next/server";
import { attachProjectHistoryEntry } from "@/lib/ai/project-history-route";
import { buildReviewPrompt, buildTaskPayloadMessages } from "@/lib/ai/prompts";
import { withAiRoute } from "@/lib/ai/route-handler";
import { generateAiResponse } from "@/lib/ai/service";
import { aiReviewStructuredSchema } from "@/lib/ai/structured-output";
import { aiReviewRequestSchema } from "@/lib/ai/validation";

export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    const data = aiReviewRequestSchema.parse(await request.json());
    const result = await generateAiResponse({
      action: "review",
      messages: buildTaskPayloadMessages({
        jsonOnly: true,
        message: buildReviewPrompt(data.budgetSummary),
        context: data.context,
      }),
      schema: aiReviewStructuredSchema,
      userId: session.user.id,
    });

    return NextResponse.json(
      await attachProjectHistoryEntry({
        action: "review",
        context: data.context,
        projectId: data.projectId,
        result,
        summary: data.budgetSummary.slice(0, 140),
        userId: session.user.id,
      }),
    );
  });
}
