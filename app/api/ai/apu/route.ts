import { NextResponse } from "next/server";
import { attachProjectHistoryEntry } from "@/lib/ai/project-history-route";
import { buildApuPrompt, buildTaskPayloadMessages } from "@/lib/ai/prompts";
import { withAiRoute } from "@/lib/ai/route-handler";
import { generateAiResponse } from "@/lib/ai/service";
import { aiApuStructuredSchema } from "@/lib/ai/structured-output";
import { aiApuRequestSchema } from "@/lib/ai/validation";

export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    const data = aiApuRequestSchema.parse(await request.json());
    const result = await generateAiResponse({
      action: "apu",
      messages: buildTaskPayloadMessages({
        jsonOnly: true,
        message: buildApuPrompt(data.description, data.unit),
        context: data.context,
      }),
      schema: aiApuStructuredSchema,
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
