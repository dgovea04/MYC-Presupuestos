import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminSession } from "@/lib/auth/session";
import { transitionKnowledgeAssertion } from "@/lib/knowledge/assertions";
import { requireKnowledgeAdminSession, knowledgeRouteErrorResponse } from "@/lib/knowledge/route-errors";

const schema = z.object({ nextStatus: z.enum(["CONFIRMED", "VERIFIED", "CANONICAL", "REJECTED", "DEPRECATED"]), companyId: z.string().min(1), projectId: z.string().optional(), promotionScope: z.enum(["COMPANY", "GLOBAL"]).optional(), rejectionReason: z.string().optional(), correlationId: z.string().min(1).max(200) }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await requireKnowledgeAdminSession("knowledge.manage", request);
  if ("response" in authorization) return authorization.response;
  const session = authorization.session;
  try {
    const body = schema.parse(await request.json());
    if (body.nextStatus === "CANONICAL" && (body.promotionScope ?? "GLOBAL") === "GLOBAL" && !session.user.isSuperAdmin) return NextResponse.json({ error: "Solo un superadministrador puede promover conocimiento canónico" }, { status: 403 });
    if (body.nextStatus === "CANONICAL" && (body.promotionScope ?? "GLOBAL") === "GLOBAL" && !(await requireSuperAdminSession(request))) return NextResponse.json({ error: "Solo un superadministrador con MFA puede promover conocimiento canónico" }, { status: 403 });
    const result = await transitionKnowledgeAssertion({ assertionId: (await params).id, nextStatus: body.nextStatus, actorUserId: session.user.id, companyId: body.companyId, projectId: body.projectId, rejectionReason: body.rejectionReason, correlationId: body.correlationId, ...(body.promotionScope ? { promotionScope: body.promotionScope } : {}), ...(body.nextStatus === "CANONICAL" && (body.promotionScope ?? "GLOBAL") === "GLOBAL" ? { allowGlobalPromotion: true } : {}) });
    return NextResponse.json(result);
  } catch (error) { return knowledgeRouteErrorResponse(error, "No se pudo actualizar la assertion"); }
}
