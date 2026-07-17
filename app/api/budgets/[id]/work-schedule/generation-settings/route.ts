import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import {
  getWorkScheduleGenerationSettings,
  saveWorkScheduleGenerationSettings,
} from "@/lib/data/work-schedule";
import { workScheduleGenerationCustomPhaseKeywordsSchema } from "@/lib/validations/work-schedule";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    await assertFeatureAccess({ userId: session.user.id, feature: "work_schedule.intelligent" });
    const { id } = await params;
    const customPhaseKeywords = await getWorkScheduleGenerationSettings(id, session.user.id);
    return NextResponse.json({ customPhaseKeywords: customPhaseKeywords ?? null });
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la configuracion de generacion" },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    await assertFeatureAccess({ userId: session.user.id, feature: "work_schedule.intelligent" });
    const { id } = await params;
    const body = await request.json();
    const raw = body.customPhaseKeywords;
    const keywords =
      raw === undefined
        ? {}
        : workScheduleGenerationCustomPhaseKeywordsSchema.parse(raw);
    await saveWorkScheduleGenerationSettings(id, session.user.id, keywords);
    return NextResponse.json({ success: true });
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la configuracion de generacion" },
      { status: 400 },
    );
  }
}
