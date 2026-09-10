import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { getKnowledgeAdminQueue } from "@/lib/knowledge/admin-queue";
import { assertKnowledgeReadAccess } from "@/lib/knowledge/api-access";
import { isKnowledgeFeatureEnabled } from "@/lib/knowledge/feature-flags";
import { WorkspaceAuthorizationError } from "@/lib/workspace/authorization";

export async function GET(request: Request) {
  const session = await requireAdminSession("audit.read");
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId") ?? undefined;
  const projectId = url.searchParams.get("projectId") ?? undefined;
  if (!companyId) return NextResponse.json({ error: "companyId es requerido" }, { status: 400 });
  const status = url.searchParams.get("status") ?? undefined;
  if (status && !["OBSERVED", "PENDING", "PROCESSING", "RETRYABLE_FAILED", "SUCCEEDED", "DEAD_LETTER"].includes(status)) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  try {
    await assertKnowledgeReadAccess({ actorUserId: session.user.id, companyId, projectId, scope: projectId ? "PROJECT" : "COMPANY" });
  } catch (error) {
    if (error instanceof WorkspaceAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
  if (!isKnowledgeFeatureEnabled("retrievalV1", { companyId, projectId })) {
    return NextResponse.json({ error: "Knowledge retrieval disabled", feature: "retrievalV1" }, { status: 503 });
  }
  try {
    return NextResponse.json(await getKnowledgeAdminQueue({ companyId, projectId, status }));
  } catch {
    return NextResponse.json({ error: "No se pudo cargar la cola de conocimiento" }, { status: 500 });
  }
}
