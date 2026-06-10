import { NextResponse } from "next/server";
import { attachProjectHistoryEntry } from "@/lib/ai/project-history-route";
import { buildChatMessages } from "@/lib/ai/prompts";
import { withAiRoute } from "@/lib/ai/route-handler";
import { generateAiResponse } from "@/lib/ai/service";
import { aiChatRequestSchema } from "@/lib/ai/validation";

export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    const data = aiChatRequestSchema.parse(await request.json());
    const result = await generateAiResponse({
      action: "chat",
      messages: buildChatMessages(data),
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
