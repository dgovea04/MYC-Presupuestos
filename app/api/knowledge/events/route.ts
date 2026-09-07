import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession, requireSuperAdminSession } from "@/lib/auth/session";
import { recordKnowledgeEvent } from "@/lib/knowledge/events";
import { assertKnowledgeApiScopeAccess } from "@/lib/knowledge/api-access";

const schema = z.object({
  eventType: z.string().min(1), scope: z.enum(["GLOBAL", "COMPANY", "PROJECT", "USER"]), companyId: z.string().optional(), projectId: z.string().optional(), userId: z.string().optional(),
  entityType: z.string().min(1), entityId: z.string().min(1), sourceType: z.string().min(1), sourceId: z.string().optional(), evidenceId: z.string().optional(), previousValue: z.unknown().optional(), newValue: z.unknown().optional(), metadata: z.record(z.string(), z.unknown()).optional(), idempotencyKey: z.string().min(1),
}).strict();

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const body = schema.parse(await request.json());
    if (body.scope === "GLOBAL" && !(await requireSuperAdminSession(request))) return NextResponse.json({ error: "Solo un superadministrador puede registrar conocimiento global" }, { status: 403 });
    await assertKnowledgeApiScopeAccess({ ...body, actorUserId: session.user.id });
    const result = await recordKnowledgeEvent({ ...body, userId: session.user.id });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Payload inválido" : error instanceof Error ? error.message : "No se pudo registrar el evento" }, { status: 400 });
  }
}
