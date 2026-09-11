import { NextResponse } from "next/server";
import { getKnowledgeAdminQueue } from "@/lib/knowledge/admin-queue";
import { assertKnowledgeReadAccess } from "@/lib/knowledge/api-access";
import { isKnowledgeFeatureEnabled } from "@/lib/knowledge/feature-flags";
import { requireKnowledgeAdminSession, knowledgeRouteErrorResponse } from "@/lib/knowledge/route-errors";

export async function GET(request: Request) {
  const authorization = await requireKnowledgeAdminSession("audit.read", request);
  if ("response" in authorization) return authorization.response;
  const session = authorization.session;
  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId") ?? undefined;
  const projectId = url.searchParams.get("projectId") ?? undefined;
  if (!companyId) return NextResponse.json({ error: "companyId es requerido" }, { status: 400 });
  const status = url.searchParams.get("status") ?? undefined;
  if (status && !["OBSERVED", "REVIEW_REQUIRED", "PENDING", "PROCESSING", "RETRYABLE_FAILED", "SUCCEEDED", "DEAD_LETTER"].includes(status)) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  try {
    await assertKnowledgeReadAccess({ actorUserId: session.user.id, companyId, projectId, scope: projectId ? "PROJECT" : "COMPANY" });
  } catch (error) {
    return knowledgeRouteErrorResponse(error, "No se pudo validar el alcance de Knowledge");
  }
  if (!isKnowledgeFeatureEnabled("adminReviewQueue", { companyId, projectId })) {
    return NextResponse.json({ error: "Knowledge admin queue disabled", feature: "adminReviewQueue" }, { status: 503 });
  }
  try {
    return NextResponse.json(await getKnowledgeAdminQueue({ companyId, projectId, status }));
  } catch {
    return NextResponse.json({ error: "No se pudo cargar la cola de conocimiento" }, { status: 500 });
  }
}
