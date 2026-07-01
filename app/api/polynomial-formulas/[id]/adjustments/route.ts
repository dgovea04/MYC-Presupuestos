import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

import { getAuthSession } from "@/lib/auth/session";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { recordActivityEvent } from "@/lib/data/activity-events";
import { prisma } from "@/lib/db/prisma";
import {
  getPolynomialFormulaAdjustmentsTag,
  calculatePolynomialFormulaAdjustment,
  listPolynomialFormulaAdjustments,
  POLYNOMIAL_FORMULA_ADJUSTMENTS_CACHE_TAG,
  POLYNOMIAL_FORMULA_SECTIONS_CACHE_TAG,
} from "@/lib/data/polynomial-formulas";
import { polynomialAdjustmentCreateSchema } from "@/lib/validations/polynomial-formula";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertFeatureAccess({ userId: session.user.id, feature: "polynomial_formula.adjustments" });
    const { id } = await params;
    const adjustments = await listPolynomialFormulaAdjustments(id, session.user.id);
    return NextResponse.json(adjustments);
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el historial de reajustes",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertFeatureAccess({ userId: session.user.id, feature: "polynomial_formula.adjustments" });
    const { id } = await params;
    const body = await request.json();
    const payload = polynomialAdjustmentCreateSchema.parse(body);
    const adjustment = await calculatePolynomialFormulaAdjustment(id, session.user.id, payload);
    const formula = await prisma.polynomialFormula.findFirst({
      where: {
        id,
        budget: {
          project: {
            company: {
              userId: session.user.id,
            },
          },
        },
      },
      select: {
        name: true,
        budgetId: true,
        budget: {
          select: {
            kind: true,
            parentBudgetId: true,
          },
        },
      },
    });

    if (formula) {
      await recordActivityEvent({
        userId: session.user.id,
        type: "ADJUSTMENT_REGISTERED",
        title: "Reajuste registrado",
        detail: `${formula.name} · ${adjustment.month}/${adjustment.year}`,
        href: `/budgets/${formula.budgetId}/polynomial-formula`,
      });
    }

    const routeBudgetId =
      formula?.budget.kind === "SUB_BUDGET" && formula.budget.parentBudgetId
        ? formula.budget.parentBudgetId
        : formula?.budgetId;

    revalidateTag(POLYNOMIAL_FORMULA_ADJUSTMENTS_CACHE_TAG, "max");
    revalidateTag(getPolynomialFormulaAdjustmentsTag(id), "max");
    revalidateTag(POLYNOMIAL_FORMULA_SECTIONS_CACHE_TAG, "max");
    if (formula?.budgetId) {
      revalidateTag(`${POLYNOMIAL_FORMULA_SECTIONS_CACHE_TAG}:${formula.budgetId}`, "max");
      revalidatePath(`/budgets/${formula.budgetId}/polynomial-formula`);
    }
    if (routeBudgetId) {
      revalidateTag(`${POLYNOMIAL_FORMULA_SECTIONS_CACHE_TAG}:${routeBudgetId}`, "max");
      revalidatePath(`/budgets/${routeBudgetId}/polynomial-formula`);
    }
    revalidatePath("/dashboard");
    revalidateTag("dashboard-stats", "max");
    revalidateTag("dashboard-analytics");
    return NextResponse.json(adjustment, { status: 201 });
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo registrar el reajuste",
      },
      { status: 400 },
    );
  }
}
