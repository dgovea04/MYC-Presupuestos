import { NextResponse } from "next/server";
import { retryKnowledgeIntegrationJob } from "@/lib/knowledge/integration-jobs";
import { assertKnowledgeWriteAccess } from "@/lib/knowledge/api-access";
import { requireKnowledgeAdminSession, knowledgeRouteErrorResponse } from "@/lib/knowledge/route-errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await requireKnowledgeAdminSession("knowledge.manage", request);
  if ("response" in authorization) return authorization.response;
  const session = authorization.session;
  const user = session.user;
  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId") ?? user.activeCompanyId ?? user.companyId;
  const projectId = url.searchParams.get("projectId") ?? undefined;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  try {
    await assertKnowledgeWriteAccess({ actorUserId: user.id, companyId, projectId, scope: projectId ? "PROJECT" : "COMPANY" });
    return NextResponse.json(await retryKnowledgeIntegrationJob((await params).id, { companyId, projectId }));
  } catch (error) {
    if (error instanceof Error && error.message === "Knowledge job not found") return NextResponse.json({ error: "Knowledge job not found" }, { status: 404 });
    return knowledgeRouteErrorResponse(error, "No se pudo reintentar el job");
  }
}
