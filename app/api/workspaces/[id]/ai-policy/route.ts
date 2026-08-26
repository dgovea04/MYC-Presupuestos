import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { getEffectiveAiPolicy, updateWorkspaceAiPolicy } from "@/lib/ai/credentials/policy-service";
import { aiPolicyInputSchema } from "@/lib/ai/credentials/policy-types";
import { requireWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/workspace/authorization";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: workspaceId } = await params;
  try {
    await requireWorkspaceRole({ userId: session.user.id, companyId: workspaceId, minimumRole: "VIEWER" });
    return NextResponse.json(await getEffectiveAiPolicy({ userId: session.user.id, workspaceId }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar la política AI." }, { status: error instanceof WorkspaceAuthorizationError ? 403 : 400 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: workspaceId } = await params;
  try {
    const payload: unknown = await request.json();
    const input = aiPolicyInputSchema.parse(payload);
    const policy = await updateWorkspaceAiPolicy({ actorUserId: session.user.id, workspaceId, input });
    return NextResponse.json({
      id: policy.id,
      workspaceId: policy.workspaceId,
      mode: policy.mode,
      defaultProvider: policy.defaultProvider,
      allowedProviders: policy.allowedProviders,
      allowedModels: policy.allowedModels,
      allowUserKeys: policy.allowUserKeys,
      allowWorkspaceKey: policy.allowWorkspaceKey,
      fallbackEnabled: policy.fallbackEnabled,
      monthlyTokenLimit: policy.monthlyTokenLimit,
      monthlyBudgetMinor: policy.monthlyBudgetMinor,
      hardLimit: policy.hardLimit,
      alertThresholds: policy.alertThresholds,
      allowAgentWrites: policy.allowAgentWrites,
      updatedAt: policy.updatedAt,
    });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Política inválida." }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar la política AI." }, { status: 403 });
  }
}
