import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { getWorkScheduleValuationCalendarSection } from "@/lib/data/work-schedule";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    await assertFeatureAccess({ userId: session.user.id, feature: "work_schedule.intelligent" });
    const { id } = await params;
    const fromPeriodKey = request.nextUrl.searchParams.get("from") ?? undefined;
    const toPeriodKey = request.nextUrl.searchParams.get("to") ?? undefined;
    const valuationCalendar = await getWorkScheduleValuationCalendarSection(id, session.user.id, {
      fromPeriodKey,
      toPeriodKey,
    });
    return NextResponse.json(valuationCalendar);
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el calendario valorizado" },
      { status: 400 },
    );
  }
}
