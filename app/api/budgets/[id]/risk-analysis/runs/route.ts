import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { saveRiskSimulationRun } from "@/lib/risk/data";
import { runAndSaveRiskSimulation } from "@/lib/risk/simulation-service";
import { riskSimulationRunRequestSchema } from "@/lib/validations/risk";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertFeatureAccess({ userId: session.user.id, feature: "risk_analysis" });
    const { id } = await params;
    const payload = await request.json();
    const result = isServerRunRequest(payload)
      ? await runAndSaveRiskSimulation(id, session.user.id, riskSimulationRunRequestSchema.parse(payload))
      : await saveRiskSimulationRun(id, session.user.id, payload);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    return NextResponse.json({ error: getRiskRunRouteErrorMessage(error) }, { status: 400 });
  }
}

function isServerRunRequest(payload: unknown): boolean {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  const allowedKeys = new Set(["budgetId", "scenarioId", "seed"]);
  const keys = Object.keys(candidate);

  return keys.length > 0 && keys.every((key) => allowedKeys.has(key));
}

function getRiskRunRouteErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Los datos de la simulacion no son validos";
  }

  return error instanceof Error ? error.message : "No se pudo guardar la simulacion de riesgo";
}
