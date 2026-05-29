import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { getRiskAnalysisPayload } from "@/lib/risk/data";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertFeatureAccess({ userId: session.user.id, feature: "risk_analysis" });
    const { id } = await params;
    const payload = await getRiskAnalysisPayload(id, session.user.id);
    return NextResponse.json(payload);
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el analisis de riesgo" },
      { status: 400 },
    );
  }
}
