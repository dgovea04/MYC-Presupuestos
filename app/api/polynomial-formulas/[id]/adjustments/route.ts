import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { recordActivityEvent } from "@/lib/data/activity-events";
import { prisma } from "@/lib/db/prisma";
import {
  calculatePolynomialFormulaAdjustment,
  listPolynomialFormulaAdjustments,
} from "@/lib/data/polynomial-formulas";
import { polynomialAdjustmentCreateSchema } from "@/lib/validations/polynomial-formula";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const adjustments = await listPolynomialFormulaAdjustments(id, session.user.id);
    return NextResponse.json(adjustments);
  } catch (error) {
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

    return NextResponse.json(adjustment, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo registrar el reajuste",
      },
      { status: 400 },
    );
  }
}
