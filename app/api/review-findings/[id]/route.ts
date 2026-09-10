import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { getFinding } from "@/lib/review-intelligence/findings";
import { enrichPersistedReviewFinding } from "@/lib/knowledge/review-enrichment";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const companyId = session.user.activeCompanyId ?? session.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  try { await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "VIEWER" }); const finding = await getFinding((await params).id, companyId); const projectId = typeof finding.projectId === "string" ? finding.projectId : undefined; const correlationId = request.headers.get("x-correlation-id") ?? `review-enrichment:${(await params).id}`; const enriched = projectId ? await enrichPersistedReviewFinding(finding, { companyId, projectId, correlationId }) : { ...finding, knowledge: [], knowledgeTelemetry: { enabled: false, fallback: false, latencyMs: 0 } }; return NextResponse.json(enriched); } catch (error) { const message = error instanceof Error ? error.message : "No se pudo cargar el hallazgo"; return NextResponse.json({ error: message }, { status: /access|workspace|rol|acceso/i.test(message) ? 403 : 404 }); }
}
