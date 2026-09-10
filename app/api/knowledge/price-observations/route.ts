import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession, requireSuperAdminSession } from "@/lib/auth/session";
import { assertKnowledgeApiScopeAccess, assertKnowledgeEntityAccess } from "@/lib/knowledge/api-access";
import { createPriceObservation } from "@/lib/knowledge/observations";

const schema = z.object({ resourceId: z.string().min(1), value: z.string().min(1), currency: z.string().optional(), unit: z.string().min(1), scope: z.enum(["GLOBAL", "COMPANY", "PROJECT", "USER"]), projectId: z.string().optional(), sourceId: z.string().min(1), evidenceId: z.string().optional(), observedAt: z.coerce.date(), confidence: z.enum(["VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERY_HIGH"]) }).strict();

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const body = schema.parse(await request.json());
    const companyId = session.user.activeCompanyId ?? session.user.companyId;
    if (body.scope === "GLOBAL" && !(await requireSuperAdminSession(request))) return NextResponse.json({ error: "Solo un superadministrador puede crear observaciones globales" }, { status: 403 });
    if (body.scope !== "GLOBAL" && !companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
    await assertKnowledgeApiScopeAccess({ actorUserId: session.user.id, scope: body.scope, companyId: body.scope === "GLOBAL" ? undefined : companyId ?? undefined, projectId: body.projectId, userId: body.scope === "USER" ? session.user.id : undefined });
    if (companyId) {
      await assertKnowledgeEntityAccess({ actorUserId: session.user.id, entityType: "KnowledgeSource", entityId: body.sourceId, companyId, projectId: body.projectId });
      await assertKnowledgeEntityAccess({ actorUserId: session.user.id, entityType: "CanonicalResource", entityId: body.resourceId, companyId, projectId: body.projectId });
      if (body.evidenceId) await assertKnowledgeEntityAccess({ actorUserId: session.user.id, entityType: "KnowledgeEvidence", entityId: body.evidenceId, companyId, projectId: body.projectId });
    }
    return NextResponse.json(await createPriceObservation({ ...body, companyId: body.scope === "GLOBAL" ? undefined : companyId ?? undefined, userId: body.scope === "USER" ? session.user.id : undefined }), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Payload inválido" : error instanceof Error ? error.message : "No se pudo crear la observación" }, { status: 400 });
  }
}
