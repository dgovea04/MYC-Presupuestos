import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession, requireSuperAdminSession } from "@/lib/auth/session";
import { transitionKnowledgeAssertion } from "@/lib/knowledge/assertions";

const schema = z.object({ nextStatus: z.enum(["CONFIRMED", "VERIFIED", "CANONICAL", "REJECTED", "DEPRECATED"]), companyId: z.string().min(1), projectId: z.string().optional(), rejectionReason: z.string().optional(), correlationId: z.string().min(1).max(200) }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession("knowledge.manage", request);
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const body = schema.parse(await request.json());
    if (body.nextStatus === "CANONICAL" && !session.user.isSuperAdmin) return NextResponse.json({ error: "Solo un superadministrador puede promover conocimiento canónico" }, { status: 403 });
    if (body.nextStatus === "CANONICAL" && !(await requireSuperAdminSession(request))) return NextResponse.json({ error: "Solo un superadministrador con MFA puede promover conocimiento canónico" }, { status: 403 });
    const result = await transitionKnowledgeAssertion({ assertionId: (await params).id, nextStatus: body.nextStatus, actorUserId: session.user.id, companyId: body.companyId, projectId: body.projectId, rejectionReason: body.rejectionReason, correlationId: body.correlationId, ...(body.nextStatus === "CANONICAL" ? { allowGlobalPromotion: true } : {}) });
    return NextResponse.json(result);
  } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? "Payload inválido" : error instanceof Error ? error.message : "No se pudo actualizar la assertion" }, { status: 400 }); }
}
