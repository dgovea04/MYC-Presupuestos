import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import { resolveKnowledgeAssertionConflict } from "@/lib/knowledge/assertions";

const schema = z.object({ companyId: z.string().min(1), projectId: z.string().optional(), resolution: z.enum(["RESOLVED", "DISMISSED"]), reason: z.string().trim().min(1).max(2000), correlationId: z.string().trim().min(1).max(200) }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession("knowledge.manage", request);
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const body = schema.parse(await request.json());
    const result = await resolveKnowledgeAssertionConflict({ conflictId: (await params).id, actorUserId: session.user.id, ...body });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Payload inválido" : error instanceof Error ? error.message : "No se pudo resolver el conflicto" }, { status: 400 });
  }
}
