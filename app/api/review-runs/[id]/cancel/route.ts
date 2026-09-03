import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { requestReviewCancellation, type ReviewJobClient } from "@/lib/review-intelligence/jobs";
import { assertWorkspaceMembership } from "@/lib/workspace/access";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const companyId = session.user.activeCompanyId ?? session.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  try {
    await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "EDITOR" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No tienes acceso al workspace" }, { status: 403 });
  }
  try {
    const { id } = await params;
    await requestReviewCancellation(id, companyId, prisma as unknown as ReviewJobClient);
    return NextResponse.json({ ok: true, reviewRunId: id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cancelar la revisión" }, { status: 404 });
  }
}
