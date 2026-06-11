import { NextResponse } from "next/server";

import { getLatestAiSuggestionFeedbackByHistoryEntry } from "@/lib/ai/suggestion-feedback";
import { getAuthSession } from "@/lib/auth/session";
import { getProjectHeaderById } from "@/lib/data/projects";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const project = await getProjectHeaderById(id, session.user.id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const historyEntryIds = new URL(request.url).searchParams
      .getAll("historyEntryId")
      .map((historyEntryId) => historyEntryId.trim())
      .filter((historyEntryId) => historyEntryId.length > 0);

    if (historyEntryIds.length === 0) {
      return NextResponse.json({ feedbackByHistoryId: {} });
    }

    const feedbackByHistoryId = await getLatestAiSuggestionFeedbackByHistoryEntry({
      projectId: id,
      userId: session.user.id,
      historyEntryIds,
    });

    return NextResponse.json({ feedbackByHistoryId });
  } catch {
    return NextResponse.json({ error: "Unable to load feedback state" }, { status: 500 });
  }
}
