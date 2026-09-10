import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { createKnowledgeSource } from "@/lib/knowledge/provenance";
import { assertKnowledgeApiScopeAccess } from "@/lib/knowledge/api-access";

const schema = z.object({ sourceType: z.string().min(1), label: z.string().min(1), projectId: z.string().optional(), privacy: z.enum(["PRIVATE", "AGGREGATABLE", "PUBLIC"]).optional(), metadata: z.record(z.string(), z.unknown()).optional() }).strict();

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try { const body = schema.parse(await request.json()); const companyId = session.user.activeCompanyId ?? session.user.companyId; if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 }); await assertKnowledgeApiScopeAccess({ actorUserId: session.user.id, scope: body.projectId ? "PROJECT" : "COMPANY", companyId, projectId: body.projectId }); return NextResponse.json(await createKnowledgeSource({ ...body, actorUserId: session.user.id, companyId }), { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? "Payload inválido" : error instanceof Error ? error.message : "No se pudo crear la fuente" }, { status: 400 }); }
}
