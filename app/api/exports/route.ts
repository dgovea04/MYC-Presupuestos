import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { trackServerEvent } from "@/lib/analytics/events";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { prisma } from "@/lib/db/prisma";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { createCentralizedExport, createExportResponse } from "@/lib/exports/centralized";
import { trackBetaFeatureUsed } from "@/lib/beta/analytics";
import type { ExportRequest, ExportTarget } from "@/lib/exports/definitions";

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
    const companyId = session.user.activeCompanyId ?? session.user.companyId ?? "";
    await safelyTrackExportCompleted(body, session.user.id, companyId);
    await safelyTrackDemoExportCompleted(body, session.user.id, companyId);
    if (body.format === "csv" || body.format === "zip" || body.target === "work_schedule") {
      await trackBetaFeatureUsed({ userId: session.user.id, companyId, feature: "exports.advanced" }).catch(() => undefined);
    }
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

const BUDGET_EXPORT_TARGETS: readonly ExportTarget[] = [
  "budget",
  "apu",
  "budget_resources",
  "general_expenses",
  "budget_footer",
  "polynomial_formula",
  "work_schedule",
];

async function safelyTrackExportCompleted(request: ExportRequest, userId: string, companyId: string) {
  if (!companyId) {
    return;
  }

  try {
    await trackServerEvent("export_completed", {
      userId,
      companyId: companyId || null,
      export_target: request.target,
      format: request.format,
    });
  } catch {
    // Analytics must not turn a completed export into an API failure.
  }
}

async function safelyTrackDemoExportCompleted(request: ExportRequest, userId: string, companyId: string) {
  try {
    if (!companyId || !BUDGET_EXPORT_TARGETS.includes(request.target)) {
      return;
    }

    const budget = await prisma.budget.findFirst({
      where: { id: request.targetId },
      select: {
        projectId: true,
        project: { select: { isDemo: true } },
      },
    });

    if (!budget?.project.isDemo) {
      return;
    }

    await trackServerEvent("demo_export_completed", {
      userId,
      companyId,
      projectId: budget.projectId,
    });
  } catch {
    // Analytics must not turn a completed export into an API failure.
  }
}

function requiresAdvancedExport(request: ExportRequest) {
  if (request.format === "mcp") {
    return false;
  }

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
