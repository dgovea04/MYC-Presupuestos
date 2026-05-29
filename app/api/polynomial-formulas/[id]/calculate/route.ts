import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { calculateCoefficientK } from "@/lib/calculations/polynomial-formula";
import { calculatePolynomialFormulaKPreview } from "@/lib/data/polynomial-formulas";
import { polynomialKCalculationSchema } from "@/lib/validations/polynomial-formula";

const polynomialFormulaPeriodSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(1979),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertFeatureAccess({ userId: session.user.id, feature: "polynomial_formula.adjustments" });
    const { id } = await params;
    const body = await request.json();

    if (Array.isArray(body?.monomials)) {
      const payload = polynomialKCalculationSchema.parse(body);
      const calculation = calculateCoefficientK(payload.monomials);
      return NextResponse.json(calculation);
    }

    const payload = polynomialFormulaPeriodSchema.parse(body);
    const calculation = await calculatePolynomialFormulaKPreview(id, session.user.id, payload);
    return NextResponse.json(calculation);
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo calcular el coeficiente K",
      },
      { status: 400 },
    );
  }
}
