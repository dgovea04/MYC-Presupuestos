import { NextResponse } from "next/server";
import Decimal from "decimal.js";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import { getFeatureAccessResponse } from "@/lib/billing/route-access";
import { updateBudgetItemQuantityFromMetrados } from "@/lib/data/metrados";

const quantitySchema = z.union([z.number(), z.string()]).transform((value, context) => {
  try {
    const quantity = new Decimal(value);
    if (!quantity.isFinite() || quantity.isNegative()) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "El metrado debe ser un número mayor o igual a cero." });
      return z.NEVER;
    }
    return quantity.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "El metrado no es válido." });
    return z.NEVER;
  }
});

const bodySchema = z.object({ quantity: quantitySchema });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const accessResponse = await getFeatureAccessResponse(session.user.id, "metrados.advanced");
  if (accessResponse) return accessResponse;

  try {
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    const result = await updateBudgetItemQuantityFromMetrados({
      itemId: id,
      userId: session.user.id,
      quantity: body.quantity,
      deactivateAdvancedSheets: true,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: error instanceof z.ZodError ? error.issues[0]?.message : "Revisa el metrado." }, { status: 400 });
    }
    console.error("Metrado quantity PATCH failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar el metrado." }, { status: 400 });
  }
}
