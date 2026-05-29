import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { saveRiskVariables } from "@/lib/risk/data";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertFeatureAccess({ userId: session.user.id, feature: "risk_analysis" });
    const { id } = await params;
    const payload = await request.json();
    const result = await saveRiskVariables(id, session.user.id, payload);
    return NextResponse.json(result);
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    return NextResponse.json({ error: getRiskRouteErrorMessage(error) }, { status: 400 });
  }
}

function getRiskRouteErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Los datos de variables de riesgo no son validos";
  }

  return error instanceof Error ? error.message : "No se pudieron guardar las variables de riesgo";
}
