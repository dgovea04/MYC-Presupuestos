import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getAuthSession } from "@/lib/auth/session";
import { requireWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/workspace/authorization";
import { aiPolicyInputSchema } from "@/lib/ai/credentials/policy-types";
import { updateScopedAiPolicy } from "@/lib/ai/credentials/policy-service";

const querySchema = z.object({ scope: z.enum(["TEAM", "PROJECT"]), entityId: z.string().trim().min(1) });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: workspaceId } = await params;
  try {
    await requireWorkspaceRole({ userId: session.user.id, companyId: workspaceId, minimumRole: "VIEWER" });
    const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const policy = await prisma.aiPolicy.findFirst({ where: query.scope === "TEAM" ? { teamId: query.entityId, team: { companyId: workspaceId } } : { projectId: query.entityId, project: { companyId: workspaceId } } });
    return NextResponse.json({ policy: policy ? sanitizePolicy(policy) : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar la política." }, { status: error instanceof WorkspaceAuthorizationError ? 403 : 400 }); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: workspaceId } = await params;
  try {
    await requireWorkspaceRole({ userId: session.user.id, companyId: workspaceId, minimumRole: "ADMIN" });
    const body = await request.json() as unknown;
    const input = z.object({ scope: z.enum(["TEAM", "PROJECT"]), entityId: z.string().trim().min(1), policy: aiPolicyInputSchema }).parse(body);
    const policy = await updateScopedAiPolicy({ actorUserId: session.user.id, workspaceId, scope: input.scope, entityId: input.entityId, input: input.policy });
    return NextResponse.json({ policy: sanitizePolicy(policy) });
  } catch (error) { return NextResponse.json({ error: error instanceof ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "No se pudo actualizar la política." }, { status: error instanceof WorkspaceAuthorizationError ? 403 : 400 }); }
}

function sanitizePolicy(policy: { id: string; workspaceId: string | null; teamId: string | null; projectId: string | null; mode: string; defaultProvider: string; allowedProviders: string[]; allowedModels: string[]; allowUserKeys: boolean; allowWorkspaceKey: boolean; fallbackEnabled: boolean; monthlyTokenLimit: number | null; monthlyBudgetMinor: number | null; hardLimit: boolean; alertThresholds: number[]; allowAgentWrites: boolean; updatedAt: Date }) { return { ...policy }; }
