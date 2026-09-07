import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { getPrivateLearningMetrics } from "@/lib/private-learning/metrics";

export async function GET(_request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { const { companyId } = await params; await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "VIEWER" }); return NextResponse.json({ metrics: await getPrivateLearningMetrics(companyId) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron cargar las métricas" }, { status: 403 }); }
}
