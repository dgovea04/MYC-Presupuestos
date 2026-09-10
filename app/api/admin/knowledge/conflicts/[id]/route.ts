import { NextResponse } from "next/server";
import { z } from "zod";
import { requireKnowledgeAdminSession, knowledgeRouteErrorResponse } from "@/lib/knowledge/route-errors";
import { resolveKnowledgeAssertionConflict } from "@/lib/knowledge/assertions";

const schema = z.object({ companyId: z.string().min(1), projectId: z.string().optional(), resolution: z.enum(["RESOLVED", "DISMISSED"]), reason: z.string().trim().min(1).max(2000), correlationId: z.string().trim().min(1).max(200) }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await requireKnowledgeAdminSession("knowledge.manage", request);
  if ("response" in authorization) return authorization.response;
  const session = authorization.session;
  try {
    const body = schema.parse(await request.json());
    const result = await resolveKnowledgeAssertionConflict({ conflictId: (await params).id, actorUserId: session.user.id, ...body });
    return NextResponse.json(result);
  } catch (error) {
    return knowledgeRouteErrorResponse(error, "No se pudo resolver el conflicto");
  }
}
