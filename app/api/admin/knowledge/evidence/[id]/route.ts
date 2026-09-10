import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { getKnowledgeEvidenceProvenance } from "@/lib/knowledge/provenance-explorer";
import { assertKnowledgeReadAccess } from "@/lib/knowledge/api-access";
import { WorkspaceAuthorizationError } from "@/lib/workspace/authorization";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession("audit.read");
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const user = session.user;
  const companyId = new URL(request.url).searchParams.get("companyId") ?? user.activeCompanyId ?? user.companyId;
  const projectId = new URL(request.url).searchParams.get("projectId") ?? undefined;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  try {
    await assertKnowledgeReadAccess({ actorUserId: user.id, companyId, projectId, scope: projectId ? "PROJECT" : "COMPANY" });
    return NextResponse.json(await getKnowledgeEvidenceProvenance((await params).id, { companyId, projectId }));
  } catch (error) {
    if (error instanceof WorkspaceAuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: "No se pudo consultar provenance" }, { status: 500 });
  }
}
