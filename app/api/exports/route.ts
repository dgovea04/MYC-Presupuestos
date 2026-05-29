import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { createCentralizedExport, createExportResponse } from "@/lib/exports/centralized";
import type { ExportRequest } from "@/lib/exports/definitions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ExportRequest;
    if (requiresAdvancedExport(body)) {
      await assertFeatureAccess({ userId: session.user.id, feature: "exports.advanced" });
    }

    const result = await createCentralizedExport(body, session.user.id);
    return createExportResponse(result);
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la exportacion" },
      { status: 400 },
    );
  }
}

function requiresAdvancedExport(request: ExportRequest) {
  if (request.format === "csv" || request.format === "zip") {
    return true;
  }

  if (request.target === "work_schedule") {
    return true;
  }

  const advancedVisuals =
    request.options?.includeGanttChart === true ||
    request.options?.includeCurveChart === true ||
    request.options?.includeCriticalPath === true;

  return advancedVisuals;
}
