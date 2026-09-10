import { NextResponse } from "next/server";
import { getKnowledgeEvidenceProvenance } from "@/lib/knowledge/provenance-explorer";
import { assertKnowledgeReadAccess } from "@/lib/knowledge/api-access";
import { requireKnowledgeAdminSession, knowledgeRouteErrorResponse } from "@/lib/knowledge/route-errors";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await requireKnowledgeAdminSession("audit.read", request);
  if ("response" in authorization) return authorization.response;
  const session = authorization.session;
  const user = session.user;
  const companyId = new URL(request.url).searchParams.get("companyId") ?? user.activeCompanyId ?? user.companyId;
  const projectId = new URL(request.url).searchParams.get("projectId") ?? undefined;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  try {
    await assertKnowledgeReadAccess({ actorUserId: user.id, companyId, projectId, scope: projectId ? "PROJECT" : "COMPANY" });
    return NextResponse.json(await getKnowledgeEvidenceProvenance((await params).id, { companyId, projectId }));
  } catch (error) { return knowledgeRouteErrorResponse(error, "No se pudo consultar provenance"); }
}
