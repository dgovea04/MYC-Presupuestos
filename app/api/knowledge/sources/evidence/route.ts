import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { createKnowledgeEvidence } from "@/lib/knowledge/provenance";
import { assertKnowledgeWriteAccess } from "@/lib/knowledge/api-access";
import { knowledgeRouteErrorResponse } from "@/lib/knowledge/route-errors";

const schema = z.object({ sourceId: z.string().min(1), projectId: z.string().optional(), documentId: z.string().optional(), fileName: z.string().optional(), page: z.string().optional(), sheet: z.string().optional(), cellRange: z.string().optional(), url: z.string().url().optional(), quote: z.string().optional(), checksum: z.string().optional(), metadata: z.record(z.string(), z.unknown()).optional() }).strict();

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try { const body = schema.parse(await request.json()); const companyId = session.user.activeCompanyId ?? session.user.companyId; if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 }); await assertKnowledgeWriteAccess({ actorUserId: session.user.id, entityType: "KnowledgeSource", entityId: body.sourceId, companyId, projectId: body.projectId }); return NextResponse.json(await createKnowledgeEvidence({ ...body, actorUserId: session.user.id, companyId }), { status: 201 }); }
  catch (error) { return knowledgeRouteErrorResponse(error, "No se pudo crear la evidencia"); }
}
