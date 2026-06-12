import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import {
  createCustomMetradoFormula,
  listCustomMetradoFormulas,
  updateCustomMetradoFormula,
} from "@/lib/data/metrados";
import { validateCustomMetradoExpression } from "@/lib/metrados/formula-engine";
import type { MetradoFormulaRecord, MetradoUnit } from "@/types/metrado";

const units = ["m", "m2", "m3", "kg", "und", "glb", "p2", "ml", "pza", "bol", "gal", "ton", "mes", "día", "viaje", "pto", "jgo", "pln", "mll"] as const satisfies MetradoUnit[];

const variableNameSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Usa variables sin espacios ni caracteres especiales.");

const formulaPayloadSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  category: z.string().trim().min(1).default("Personalizado"),
  expression: z.string().trim().min(1),
  requiredInputs: z.array(variableNameSchema).min(1),
  resultUnit: z.enum(units),
  showInSuggestions: z.boolean().default(false),
});

const createFormulaSchema = formulaPayloadSchema;
const updateFormulaSchema = formulaPayloadSchema.extend({
  id: z.string().trim().min(1),
});

export async function GET() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const formulas = await listCustomMetradoFormulas(session.user.id);
  return NextResponse.json({ formulas });
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = createFormulaSchema.parse(await request.json());
    const uniqueInputs = [...new Set(body.requiredInputs)];
    const validationError = validateCustomMetradoExpression(buildProbeFormula(body, uniqueInputs));

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const formula = await createCustomMetradoFormula({
      userId: session.user.id,
      name: body.name,
      description: body.description,
      category: body.category,
      expression: body.expression,
      requiredInputs: uniqueInputs,
      resultUnit: body.resultUnit,
      showInSuggestions: body.showInSuggestions,
    });

    return NextResponse.json({ formula }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Revisa los datos de la formula." }, { status: 400 });
    }

    console.error("Custom metrado formula POST failed", error);
    return NextResponse.json({ error: "No se pudo guardar la formula." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = updateFormulaSchema.parse(await request.json());
    const uniqueInputs = [...new Set(body.requiredInputs)];
    const validationError = validateCustomMetradoExpression(buildProbeFormula(body, uniqueInputs));

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const formula = await updateCustomMetradoFormula({
      id: body.id,
      userId: session.user.id,
      name: body.name,
      description: body.description,
      category: body.category,
      expression: body.expression,
      requiredInputs: uniqueInputs,
      resultUnit: body.resultUnit,
      showInSuggestions: body.showInSuggestions,
    });

    return NextResponse.json({ formula });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Revisa los datos de la formula." }, { status: 400 });
    }

    if (error instanceof Error && error.message === "La formula personalizada no existe.") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Custom metrado formula PATCH failed", error);
    return NextResponse.json({ error: "No se pudo actualizar la formula." }, { status: 500 });
  }
}

function buildProbeFormula(
  input: {
    name: string;
    expression: string;
    resultUnit: MetradoUnit;
  },
  requiredInputs: string[],
): MetradoFormulaRecord {
  return {
    id: "formula-preview",
    templateId: "custom-user",
    key: "formula-preview",
    label: input.name,
    expression: input.expression,
    requiredInputs,
    resultUnit: input.resultUnit,
    source: "user",
  };
}
