import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { requestReviewCancellation, type ReviewJobClient } from "@/lib/review-intelligence/jobs";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const { id } = await params;
    const companyId = session.user.companyId ?? session.user.activeCompanyId;
    if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
    await requestReviewCancellation(id, companyId, prisma as unknown as ReviewJobClient);
    return NextResponse.json({ ok: true, reviewRunId: id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cancelar la revisión" }, { status: 404 });
  }
}
