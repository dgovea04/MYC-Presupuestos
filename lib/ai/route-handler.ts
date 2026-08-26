import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AiRuntimeError } from "@/lib/ai/errors";
import { AiTokenLimitExceededError } from "@/lib/ai/usage";
import { getAuthSession } from "@/lib/auth/session";
import { OllamaConnectionError, OllamaResponseError } from "@/lib/ai/ollama";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { assertAiCapabilityAccess, type AiCapability } from "@/lib/ai/route-access-matrix";
import { ScopedAiBudgetExceededError } from "@/lib/ai/usage-scope";

type AiRouteSession = NonNullable<Awaited<ReturnType<typeof getAuthSession>>>;
type AiRouteOptions = {
  capability?: AiCapability;
  workspaceId?: string | null;
};

export async function withAiRoute(
  handler: (session: AiRouteSession) => Promise<Response>,
  options: AiRouteOptions = {},
) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.status === "SUSPENDED") return NextResponse.json({ error: "Usuario suspendido" }, { status: 403 });

  try {
    const workspaceId = options.workspaceId ?? session.user.activeCompanyId ?? session.user.companyId;
    const capability = options.capability;

    if (capability && workspaceId) {
      await assertAiCapabilityAccess({ userId: session.user.id, workspaceId, capability });
    } else {
      await assertFeatureAccess({ userId: session.user.id, feature: "ai.local" });
    }
    return await handler(session);
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;
    if (error instanceof ScopedAiBudgetExceededError) {
      return NextResponse.json({ error: error.message, scope: error.scope, allowance: error.allowance, usedTokens: error.usedTokens, requestedTokens: error.requestedTokens }, { status: 429 });
    }
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Solicitud invalida" }, { status: 400 });
    if (error instanceof OllamaConnectionError) return NextResponse.json({ error: error.message }, { status: 503 });
    if (error instanceof OllamaResponseError) return NextResponse.json({ error: error.message }, { status: 502 });
    if (error instanceof AiRuntimeError) {
      if (error.code === "local_only") return NextResponse.json({ error: error.message }, { status: 403 });
      if (error.code === "connection" || error.code === "model_missing" || error.code === "timeout") return NextResponse.json({ error: error.message }, { status: 503 });
      if (error.code === "invalid_response" || error.code === "validation_failed") return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof AiTokenLimitExceededError) return NextResponse.json({ error: error.message, allowance: error.allowance, usedTokens: error.usedTokens, requestedTokens: error.requestedTokens }, { status: 429 });

    const statusCode = error instanceof Error && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error inesperado de IA" }, { status: statusCode });
  }
}
