import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { getWorkScheduleCurveSeriesSection } from "@/lib/data/work-schedule";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    await assertFeatureAccess({ userId: session.user.id, feature: "work_schedule.intelligent" });
    const { id } = await params;
    const curveSeries = await getWorkScheduleCurveSeriesSection(id, session.user.id);
    return NextResponse.json(curveSeries);
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la curva S" },
      { status: 400 },
    );
  }
}
