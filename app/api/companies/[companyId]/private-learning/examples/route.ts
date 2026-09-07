import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { companyId } = await params;
    await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "VIEWER" });
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
    const examples = await prisma.privateLearningExample.findMany({ where: { companyId }, select: { id: true, companyId: true, sourceType: true, sourceId: true, signalType: true, contentHash: true, schemaVersion: true, status: true, expiresAt: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: Number.isFinite(limit) && limit > 0 ? limit : 50 });
    return NextResponse.json({ examples: examples.map((example) => ({ ...example, expiresAt: example.expiresAt.toISOString(), createdAt: example.createdAt.toISOString() })) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron cargar los ejemplos" }, { status: 403 }); }
}
