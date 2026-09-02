import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getReviewProgress, type ReviewJobClient } from "@/lib/review-intelligence/jobs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const { id } = await params;
    const progress = await getReviewProgress(id, session.user.companyId ?? session.user.activeCompanyId ?? "", prisma as unknown as ReviewJobClient);
    return NextResponse.json(progress);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar la revisión" }, { status: 404 });
  }
}
