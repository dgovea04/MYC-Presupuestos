import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { retrieveKnowledgeV1 } from "@/lib/knowledge/retrieval-v1";
import { assertKnowledgeReadAccess } from "@/lib/knowledge/api-access";
import { isKnowledgeFeatureEnabled } from "@/lib/knowledge/feature-flags";

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const url = new URL(request.url);
  const companyId = session.user.activeCompanyId ?? session.user.companyId;
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (!companyId || !query) return NextResponse.json({ error: "companyId y q son requeridos" }, { status: 400 });
  try {
    const projectId = url.searchParams.get("projectId") ?? undefined;
    await assertKnowledgeReadAccess({ actorUserId: session.user.id, companyId, projectId, scope: projectId ? "PROJECT" : "COMPANY" });
    if (!isKnowledgeFeatureEnabled("retrievalV1", { companyId, projectId })) {
      return NextResponse.json({ error: "Knowledge retrieval disabled", feature: "retrievalV1" }, { status: 503 });
    }
    const statusValue = url.searchParams.get("status") ?? undefined;
    const confidenceValue = url.searchParams.get("confidence") ?? undefined;
    const regionId = url.searchParams.get("regionId") ?? undefined;
    const statuses = ["OBSERVED", "CONFIRMED", "VERIFIED", "CANONICAL", "REJECTED", "DEPRECATED"] as const;
    const confidences = ["LOW", "MEDIUM", "HIGH"] as const;
    const limitValue = Number(url.searchParams.get("limit") ?? "20");
    if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 100) return NextResponse.json({ error: "limit inválido" }, { status: 400 });
    if (statusValue && !statuses.includes(statusValue as typeof statuses[number])) return NextResponse.json({ error: "status inválido" }, { status: 400 });
    if (confidenceValue && !confidences.includes(confidenceValue as typeof confidences[number])) return NextResponse.json({ error: "confidence inválido" }, { status: 400 });
    return NextResponse.json(await retrieveKnowledgeV1({ companyId, projectId, query, limit: limitValue, ...(statusValue ? { status: statusValue as typeof statuses[number] } : {}), ...(confidenceValue ? { confidence: confidenceValue as typeof confidences[number] } : {}), ...(regionId ? { regionId } : {}) }));
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo recuperar conocimiento" }, { status: 403 }); }
}
