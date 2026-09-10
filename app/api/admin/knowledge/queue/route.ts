import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { getKnowledgeAdminQueue } from "@/lib/knowledge/admin-queue";

export async function GET(request: Request) {
  const session = await requireAdminSession("audit.read");
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  if (status && !["OBSERVED", "PENDING", "PROCESSING", "RETRYABLE_FAILED", "SUCCEEDED", "DEAD_LETTER"].includes(status)) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  return NextResponse.json(await getKnowledgeAdminQueue({ companyId: url.searchParams.get("companyId") ?? undefined, projectId: url.searchParams.get("projectId") ?? undefined, status }));
}
