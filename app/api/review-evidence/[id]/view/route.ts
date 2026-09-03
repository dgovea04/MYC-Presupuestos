import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { viewReviewEvidence } from "@/lib/review-intelligence/findings";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const companyId = session.user.activeCompanyId ?? session.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  try { await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "VIEWER" }); return NextResponse.json(await viewReviewEvidence({ evidenceId: (await params).id, companyId, userId: session.user.id, token: new URL(request.url).searchParams.get("token") ?? undefined })); } catch (error) { const message = error instanceof Error ? error.message : "No se pudo recuperar la evidencia"; return NextResponse.json({ error: message }, { status: /workspace|acceso|rol/i.test(message) ? 403 : /temporary|expired/i.test(message) ? 401 : 404 }); }
}
