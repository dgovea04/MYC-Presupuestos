import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { getKnowledgeEvidenceProvenance } from "@/lib/knowledge/provenance-explorer";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession("audit.read");
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try { return NextResponse.json(await getKnowledgeEvidenceProvenance((await params).id)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo consultar provenance" }, { status: 404 }); }
}
