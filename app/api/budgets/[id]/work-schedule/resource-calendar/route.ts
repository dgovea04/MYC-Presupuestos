import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { getWorkScheduleResourceCalendarSection } from "@/lib/data/work-schedule";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const resourceCalendar = await getWorkScheduleResourceCalendarSection(id, session.user.id);
    return NextResponse.json(resourceCalendar);
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el calendario de insumos" },
      { status: 400 },
    );
  }
}
