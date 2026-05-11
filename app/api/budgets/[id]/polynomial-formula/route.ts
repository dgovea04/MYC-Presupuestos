import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import {
  generatePolynomialFormulaFromBudget,
  getBudgetPolynomialFormulaSectionData,
  savePolynomialFormula,
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

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const section = await getBudgetPolynomialFormulaSectionData(id, session.user.id);
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
    const formula = await generatePolynomialFormulaFromBudget(id, session.user.id, payload);
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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await params;
    const body = await request.json();
    const payload = polynomialFormulaPatchSchema.parse(body);
    const formula = await savePolynomialFormula(payload.formulaId, session.user.id, payload);
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
