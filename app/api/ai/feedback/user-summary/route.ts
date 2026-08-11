import { NextResponse } from "next/server";

import { getUserAiFeedbackSummary, getUserFeedbackTrends } from "@/lib/ai/suggestion-feedback";
import { getAuthSession } from "@/lib/auth/session";
import { getFeatureAccessResponse } from "@/lib/billing/route-access";

export async function GET() {
  try {
    const session = await getAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessResponse = await getFeatureAccessResponse(session.user.id, "khipu.agent");
    if (accessResponse) return accessResponse;

    const [summary, trends] = await Promise.all([
      getUserAiFeedbackSummary({ userId: session.user.id }),
      getUserFeedbackTrends({ userId: session.user.id }),
    ]);

    return NextResponse.json({ summary, trends });
  } catch {
    return NextResponse.json({ error: "Unable to load feedback summary" }, { status: 500 });
  }
}
