import { NextResponse } from "next/server";
import { buildApuPrompt, buildChatMessages } from "@/lib/ai/prompts";
import { withAiRoute } from "@/lib/ai/route-handler";
import { generateAiResponse } from "@/lib/ai/service";
import { aiApuStructuredSchema } from "@/lib/ai/structured-output";
import { aiApuRequestSchema } from "@/lib/ai/validation";

export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    const data = aiApuRequestSchema.parse(await request.json());
    const result = await generateAiResponse({
      action: "apu",
      messages: buildChatMessages({
        message: buildApuPrompt(data.description, data.unit),
        context: data.context,
      }),
      schema: aiApuStructuredSchema,
      userId: session.user.id,
    });

    return NextResponse.json(result);
  });
}
