import { AiSuggestionFeedbackType } from "@prisma/client";
import { NextResponse } from "next/server";

import { recordAiSuggestionFeedback } from "@/lib/ai/suggestion-feedback";
import { getAuthSession } from "@/lib/auth/session";
import { getProjectHeaderById } from "@/lib/data/projects";

const FEEDBACK_TYPES = new Set<string>([
  AiSuggestionFeedbackType.APPLIED,
  AiSuggestionFeedbackType.EDITED,
  AiSuggestionFeedbackType.DISMISSED,
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; historyEntryId: string }> },
) {
  try {
    const session = await getAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { historyEntryId, id } = await params;
    const project = await getProjectHeaderById(id, session.user.id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = (await request.json()) as { feedbackType?: unknown; notes?: unknown };

    if (typeof body.feedbackType !== "string" || !FEEDBACK_TYPES.has(body.feedbackType)) {
      return NextResponse.json({ error: "Invalid feedback type" }, { status: 400 });
    }

    const notes = typeof body.notes === "string" ? body.notes.trim() : undefined;
    const feedback = await recordAiSuggestionFeedback({
      historyEntryId,
      projectId: id,
      userId: session.user.id,
      feedbackType: body.feedbackType as AiSuggestionFeedbackType,
      notes: notes === "" ? undefined : notes,
    });

    if (!feedback) {
      return NextResponse.json({ error: "Feedback target not found" }, { status: 404 });
    }

    return NextResponse.json({ feedback });
  } catch {
    return NextResponse.json({ error: "Unable to record feedback" }, { status: 500 });
  }
}
