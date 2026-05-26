import { NextResponse } from "next/server";
import { buildChatMessages, buildReviewPrompt } from "@/lib/ai/prompts";
import { withAiRoute } from "@/lib/ai/route-handler";
import { generateAiResponse } from "@/lib/ai/service";
import { aiReviewStructuredSchema } from "@/lib/ai/structured-output";
import { aiReviewRequestSchema } from "@/lib/ai/validation";

export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    const data = aiReviewRequestSchema.parse(await request.json());
    const result = await generateAiResponse({
      action: "review",
      messages: buildChatMessages({
        message: buildReviewPrompt(data.budgetSummary),
        context: data.context,
      }),
      schema: aiReviewStructuredSchema,
      userId: session.user.id,
    });

    return NextResponse.json(result);
  });
}
