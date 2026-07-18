import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { saveRiskScenario } from "@/lib/risk/scenarios";
import { riskInputSourceSchema } from "@/lib/validations/risk";

const finiteNonnegativeNumber = z.number().finite().nonnegative();
const confidenceSchema = z.number().finite().min(0).max(1).nullable().optional();

const riskScenarioVariableSchema = z
  .object({
    id: z.string().optional(),
    budgetItemId: z.string().min(1),
    variableType: z.enum(["QUANTITY", "UNIT_PRICE", "DURATION"]),
    distributionType: z.enum(["TRIANGULAR", "PERT", "NORMAL", "UNIFORM"]),
    minimum: finiteNonnegativeNumber,
    mostLikely: finiteNonnegativeNumber,
    maximum: finiteNonnegativeNumber,
    enabled: z.boolean(),
    source: riskInputSourceSchema.optional(),
    confidence: confidenceSchema,
    rationale: z.string().min(1).nullable().optional(),
  })
  .refine((input) => input.minimum <= input.mostLikely, {
    message: "El minimo no puede ser mayor que el valor probable.",
    path: ["minimum"],
  })
  .refine((input) => input.mostLikely <= input.maximum, {
    message: "El valor probable no puede ser mayor que el maximo.",
    path: ["mostLikely"],
  });

const riskScenarioCorrelationSchema = z
  .object({
    id: z.string().optional(),
    sourceVariableId: z.string().min(1),
    targetVariableId: z.string().min(1),
    coefficient: z.number().finite().min(-1).max(1),
    source: riskInputSourceSchema.optional(),
    confidence: confidenceSchema,
    rationale: z.string().min(1).nullable().optional(),
  })
  .refine((input) => input.sourceVariableId !== input.targetVariableId, {
    message: "Una correlacion requiere dos variables distintas.",
    path: ["targetVariableId"],
  });

const riskScenarioRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).nullable().optional(),
  variables: z.array(riskScenarioVariableSchema),
  correlations: z.array(riskScenarioCorrelationSchema).default([]),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertFeatureAccess({ userId: session.user.id, feature: "risk_analysis" });
    const { id } = await params;
    const body = riskScenarioRequestSchema.parse(await request.json());
    const scenario = await saveRiskScenario(id, session.user.id, {
      ...body,
      description: body.description ?? null,
      source: "AGENT",
      status: "APPROVED",
    });

    return NextResponse.json(scenario, { status: 201 });
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    return NextResponse.json({ error: getRiskScenarioRouteErrorMessage(error) }, { status: 400 });
  }
}

function getRiskScenarioRouteErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Los datos del escenario de riesgo no son validos";
  }

  return error instanceof Error ? error.message : "No se pudo guardar el escenario de riesgo";
}
