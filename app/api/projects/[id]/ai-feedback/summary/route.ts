import { NextResponse } from "next/server";

import { getAiSuggestionFeedbackSummary } from "@/lib/ai/suggestion-feedback";
import { getAuthSession } from "@/lib/auth/session";
import { getProjectHeaderById } from "@/lib/data/projects";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const summary = await getAiSuggestionFeedbackSummary({
      projectId: id,
      userId: session.user.id,
    });

    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ error: "Unable to load feedback summary" }, { status: 500 });
  }
}
