import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import { recordActivityEvent } from "@/lib/data/activity-events";
import { prisma } from "@/lib/db/prisma";
import {
  generatePolynomialFormulaFromBudget,
  getBudgetPolynomialFormulaSectionData,
  savePolynomialFormula,
  type PolynomialFormulaReadOptions,
} from "@/lib/data/polynomial-formulas";
import { polynomialFormulaSaveSchema } from "@/lib/validations/polynomial-formula";

const polynomialFormulaGenerateSchema = z.object({
  name: z.string().trim().optional(),
  baseMonth: z.coerce.number().int().min(1).max(12),
  baseYear: z.coerce.number().int().min(1979),
});

const polynomialFormulaPatchSchema = polynomialFormulaSaveSchema.extend({
  formulaId: z.string().min(1),
});

const formulaReadOptions = {
  includeCompositionDetail: true,
} satisfies PolynomialFormulaReadOptions;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const section = await getBudgetPolynomialFormulaSectionData(id, session.user.id, formulaReadOptions);
    return NextResponse.json(section);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar la formula polinomica",
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
    const payload = polynomialFormulaGenerateSchema.parse(body);
    const formula = await generatePolynomialFormulaFromBudget(id, session.user.id, payload, formulaReadOptions);
    const activityHref = await getPolynomialFormulaActivityHref(formula.budgetId, session.user.id);
    await recordActivityEvent({
      userId: session.user.id,
      type: "POLYNOMIAL_FORMULA_GENERATED",
      title: "Formula polinomica generada",
      detail: formula.name,
      href: activityHref,
    });
    return NextResponse.json(formula, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo generar la formula polinomica",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = polynomialFormulaPatchSchema.parse(body);
    const formula = await savePolynomialFormula(payload.formulaId, session.user.id, payload, formulaReadOptions);
    const activityHref = await getPolynomialFormulaActivityHref(formula.budgetId, session.user.id);
    await recordActivityEvent({
      userId: session.user.id,
      type: "POLYNOMIAL_FORMULA_UPDATED",
      title: "Formula polinomica actualizada",
      detail: formula.name,
      href: activityHref,
    });
    return NextResponse.json(formula);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la formula polinomica",
      },
      { status: 400 },
    );
  }
}

async function getPolynomialFormulaActivityHref(budgetId: string, userId: string) {
  const budget = await prisma.budget.findFirst({
    where: {
      id: budgetId,
      project: {
        company: {
          userId,
        },
      },
    },
    select: {
      id: true,
      kind: true,
      parentBudgetId: true,
    },
  });

  const routeBudgetId = budget?.kind === "SUB_BUDGET" && budget.parentBudgetId ? budget.parentBudgetId : budgetId;
  return `/budgets/${routeBudgetId}/polynomial-formula`;
}
