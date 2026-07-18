import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { getRiskAnalysisPayload } from "@/lib/risk/data";
import { loadRiskWorkScheduleSummary } from "@/lib/risk/fallback";
import { suggestRiskVariables } from "@/lib/risk/suggestions";
import { riskSuggestionStrategySchema } from "@/lib/validations/risk";

const riskSuggestionsRequestSchema = z.object({
  strategy: riskSuggestionStrategySchema.default("balanced"),
  maxSuggestions: z.number().int().min(1).max(50).default(12),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertFeatureAccess({ userId: session.user.id, feature: "risk_analysis" });
    const { id } = await params;
    const body = riskSuggestionsRequestSchema.parse(await request.json());
    const payload = await getRiskAnalysisPayload(id, session.user.id);
    const workScheduleSummary = await loadRiskWorkScheduleSummary(id, session.user.id, payload.budget.kind);

    return NextResponse.json({
      suggestions: suggestRiskVariables({
        payload,
        workScheduleSummary,
        strategy: body.strategy,
        maxSuggestions: body.maxSuggestions,
      }),
    });
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    return NextResponse.json({ error: getRiskSuggestionsRouteErrorMessage(error) }, { status: 400 });
  }
}

function getRiskSuggestionsRouteErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Las opciones de sugerencias no son validas";
  }

  return error instanceof Error ? error.message : "No se pudieron generar sugerencias de riesgo";
}
