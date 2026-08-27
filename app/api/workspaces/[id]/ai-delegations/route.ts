import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createAgentDelegation, AGENT_TOOL_NAMES } from "@/lib/ai/agent/delegation-service";
import { requireWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/workspace/authorization";

const schema = z.object({ delegateeId: z.string().min(1), toolNames: z.array(z.enum(AGENT_TOOL_NAMES)).min(1), expiresAt: z.coerce.date(), projectId: z.string().nullable().optional(), teamId: z.string().nullable().optional() });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: workspaceId } = await params;
  try {
    await requireWorkspaceRole({ userId: session.user.id, companyId: workspaceId, minimumRole: "ADMIN" });
    const delegations = await prisma.agentDelegation.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, select: { id: true, delegateeId: true, delegatorId: true, projectId: true, teamId: true, toolNames: true, expiresAt: true, status: true, revokedAt: true, createdAt: true } });
    return NextResponse.json({ delegations }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron listar las delegaciones." }, { status: error instanceof WorkspaceAuthorizationError ? 403 : 400 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: workspaceId } = await params;
  try {
    const input = schema.parse(await request.json());
    const delegation = await createAgentDelegation({ actorUserId: session.user.id, workspaceId, ...input });
    return NextResponse.json({ delegation }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "No se pudo crear la delegación." }, { status: error instanceof WorkspaceAuthorizationError ? 403 : 400 }); }
}
