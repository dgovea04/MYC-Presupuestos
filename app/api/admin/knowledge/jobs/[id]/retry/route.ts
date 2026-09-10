import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { retryKnowledgeIntegrationJob } from "@/lib/knowledge/integration-jobs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession("knowledge.manage", request);
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try { return NextResponse.json(await retryKnowledgeIntegrationJob((await params).id)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo reintentar el job" }, { status: 400 }); }
}
