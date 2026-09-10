import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession, requireSuperAdminSession } from "@/lib/auth/session";
import { recordKnowledgeEvent } from "@/lib/knowledge/events";
import { assertKnowledgeWriteAccess } from "@/lib/knowledge/api-access";

const schema = z.object({
  eventType: z.string().min(1), scope: z.enum(["GLOBAL", "COMPANY", "PROJECT", "USER"]), projectId: z.string().optional(),
  entityType: z.string().min(1), entityId: z.string().min(1), sourceType: z.string().min(1), sourceId: z.string().optional(), evidenceId: z.string().optional(), previousValue: z.unknown().optional(), newValue: z.unknown().optional(), metadata: z.record(z.string(), z.unknown()).optional(), idempotencyKey: z.string().min(1),
}).strict();

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const body = schema.parse(await request.json());
    const globalSession = body.scope === "GLOBAL" ? await requireSuperAdminSession(request) : null;
    if (body.scope === "GLOBAL" && !globalSession) return NextResponse.json({ error: "Solo un superadministrador puede registrar conocimiento global" }, { status: 403 });
    const companyId = body.scope === "GLOBAL" || body.scope === "USER" ? undefined : session.user.activeCompanyId ?? session.user.companyId;
    const projectId = body.scope === "PROJECT" ? body.projectId : undefined;
    await assertKnowledgeWriteAccess({ scope: body.scope, companyId, projectId, userId: session.user.id, actorUserId: session.user.id, capability: globalSession ? "knowledge.manage" : undefined });
    if (["KnowledgeSource", "KnowledgeEvidence", "CanonicalItem", "CanonicalResource"].includes(body.entityType)) {
      await assertKnowledgeWriteAccess({ actorUserId: session.user.id, entityType: body.entityType as "KnowledgeSource" | "KnowledgeEvidence" | "CanonicalItem" | "CanonicalResource", entityId: body.entityId, companyId, projectId: body.entityType === "KnowledgeSource" || body.entityType === "KnowledgeEvidence" ? projectId : undefined, scope: body.scope === "GLOBAL" ? "GLOBAL" : undefined, minimumRole: "EDITOR", capability: globalSession ? "knowledge.manage" : undefined });
    }
    if (companyId && body.sourceId) await assertKnowledgeWriteAccess({ actorUserId: session.user.id, entityType: "KnowledgeSource", entityId: body.sourceId, companyId, projectId, minimumRole: "EDITOR" });
    if (companyId && body.evidenceId) await assertKnowledgeWriteAccess({ actorUserId: session.user.id, entityType: "KnowledgeEvidence", entityId: body.evidenceId, companyId, projectId, minimumRole: "EDITOR" });
    const result = await recordKnowledgeEvent({ ...body, companyId: companyId ?? undefined, projectId: projectId ?? undefined, sourceId: body.sourceId ?? undefined, evidenceId: body.evidenceId ?? undefined, userId: session.user.id });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Payload inválido" : error instanceof Error ? error.message : "No se pudo registrar el evento" }, { status: 400 });
  }
}
