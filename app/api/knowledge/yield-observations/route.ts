import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession, requireSuperAdminSession } from "@/lib/auth/session";
import { assertKnowledgeWriteAccess } from "@/lib/knowledge/api-access";
import { createYieldObservation } from "@/lib/knowledge/observations";

const schema = z.object({ canonicalItemId: z.string().min(1), apuVersionId: z.string().optional(), value: z.string().min(1), unit: z.string().min(1), crew: z.string().optional(), projectType: z.string().optional(), regionId: z.string().optional(), scope: z.enum(["GLOBAL", "COMPANY", "PROJECT", "USER"]), projectId: z.string().optional(), sourceId: z.string().min(1), evidenceId: z.string().optional(), observedAt: z.coerce.date(), confidence: z.enum(["VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERY_HIGH"]) }).strict();

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const body = schema.parse(await request.json());
    const companyId = session.user.activeCompanyId ?? session.user.companyId;
    const globalSession = body.scope === "GLOBAL" ? await requireSuperAdminSession(request) : null;
    if (body.scope === "GLOBAL" && !globalSession) return NextResponse.json({ error: "Solo un superadministrador puede crear observaciones globales" }, { status: 403 });
    if (body.scope !== "GLOBAL" && !companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
    await assertKnowledgeWriteAccess({ actorUserId: session.user.id, scope: body.scope, companyId: body.scope === "GLOBAL" ? undefined : companyId ?? undefined, projectId: body.projectId, userId: body.scope === "USER" ? session.user.id : undefined, capability: globalSession ? "knowledge.manage" : undefined });
    if (companyId) {
      await assertKnowledgeWriteAccess({ actorUserId: session.user.id, entityType: "KnowledgeSource", entityId: body.sourceId, companyId, projectId: body.projectId });
      await assertKnowledgeWriteAccess({ actorUserId: session.user.id, entityType: "CanonicalItem", entityId: body.canonicalItemId, companyId, projectId: body.projectId });
      if (body.evidenceId) await assertKnowledgeWriteAccess({ actorUserId: session.user.id, entityType: "KnowledgeEvidence", entityId: body.evidenceId, companyId, projectId: body.projectId });
    }
    return NextResponse.json(await createYieldObservation({ ...body, companyId: body.scope === "GLOBAL" ? undefined : companyId ?? undefined, userId: body.scope === "USER" ? session.user.id : undefined }), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Payload inválido" : error instanceof Error ? error.message : "No se pudo crear la observación" }, { status: 400 });
  }
}
