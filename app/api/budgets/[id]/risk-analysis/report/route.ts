import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { getUserSettings } from "@/lib/data/settings";
import { getRiskAnalysisPayload } from "@/lib/risk/data";
import { createRiskAnalysisPdf } from "@/lib/risk/pdf-report";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertFeatureAccess({ userId: session.user.id, feature: "risk_analysis" });
    const { id } = await params;
    const [payload, settings] = await Promise.all([
      getRiskAnalysisPayload(id, session.user.id),
      getUserSettings(session.user.id),
    ]);

    if (!payload.latestRun) {
      return NextResponse.json({ error: "Ejecuta una simulacion vigente antes de exportar el PDF." }, { status: 400 });
    }

    const pdf = await createRiskAnalysisPdf(payload, settings.currencyDecimals);

    return new NextResponse(pdf, {
      headers: {
        "Content-Disposition": `attachment; filename="riesgo-montecarlo-${id}.pdf"`,
        "Content-Type": "application/pdf",
      },
    });
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) {
      return billingResponse;
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo exportar el reporte de riesgo." },
      { status: 400 },
    );
  }
}
