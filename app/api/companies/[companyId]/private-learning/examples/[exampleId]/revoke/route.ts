import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { revokePrivateLearningExample } from "@/lib/private-learning/retrieval";

export async function POST(_request: Request, { params }: { params: Promise<{ companyId: string; exampleId: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { const { companyId, exampleId } = await params; await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "ADMIN" }); await revokePrivateLearningExample({ companyId, exampleId }); return NextResponse.json({ ok: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo revocar el ejemplo" }, { status: 403 }); }
}
