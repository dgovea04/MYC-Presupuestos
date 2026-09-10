import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { retryKnowledgeIntegrationJob } from "@/lib/knowledge/integration-jobs";
import { assertKnowledgeWriteAccess } from "@/lib/knowledge/api-access";
import { WorkspaceAuthorizationError } from "@/lib/workspace/authorization";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession("knowledge.manage", request);
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const user = session.user;
  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId") ?? user.activeCompanyId ?? user.companyId;
  const projectId = url.searchParams.get("projectId") ?? undefined;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  try {
    await assertKnowledgeWriteAccess({ actorUserId: user.id, companyId, projectId, scope: projectId ? "PROJECT" : "COMPANY" });
    return NextResponse.json(await retryKnowledgeIntegrationJob((await params).id, { companyId, projectId }));
  } catch (error) {
    if (error instanceof WorkspaceAuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof Error && error.message === "Knowledge job not found") return NextResponse.json({ error: "Knowledge job not found" }, { status: 404 });
    return NextResponse.json({ error: "No se pudo reintentar el job" }, { status: 500 });
  }
}
