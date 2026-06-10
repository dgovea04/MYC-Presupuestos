import { NextResponse } from "next/server";
import { attachProjectHistoryEntry } from "@/lib/ai/project-history-route";
import { buildAutocompletePrompt, buildChatMessages } from "@/lib/ai/prompts";
import { withAiRoute } from "@/lib/ai/route-handler";
import { generateAiResponse } from "@/lib/ai/service";
import { aiAutocompleteRequestSchema } from "@/lib/ai/validation";

export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    const data = aiAutocompleteRequestSchema.parse(await request.json());
    const result = await generateAiResponse({
      action: "autocomplete",
      messages: buildChatMessages({
        message: buildAutocompletePrompt(data.input),
        context: data.context,
      }),
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
