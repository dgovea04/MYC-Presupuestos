import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { saveRiskSimulationRun } from "@/lib/risk/data";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertFeatureAccess({ userId: session.user.id, feature: "risk_analysis" });
    const { id } = await params;
    const payload = await request.json();
    const result = await saveRiskSimulationRun(id, session.user.id, payload);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    return NextResponse.json({ error: getRiskRunRouteErrorMessage(error) }, { status: 400 });
  }
}

function getRiskRunRouteErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Los datos de la simulacion no son validos";
  }

  return error instanceof Error ? error.message : "No se pudo guardar la simulacion de riesgo";
}
