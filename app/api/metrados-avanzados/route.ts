import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import { createMetradoSheet, listMetradoSheetsByUser } from "@/lib/data/metrados";
import type { MetradoTemplateType } from "@/types/metrado";
import { getFeatureAccessResponse } from "@/lib/billing/route-access";

const templateTypes = [
  "CONCRETE",
  "REBAR",
  "FORMWORK",
  "MASONRY",
  "PLASTER",
  "PAINT",
  "EXCAVATION",
  "FLOORING",
  "ROOFING",
  "CUSTOM",
] as const satisfies MetradoTemplateType[];

const createSheetSchema = z.object({
  projectId: z.string().trim().min(1),
  budgetId: z.string().trim().min(1),
  budgetItemId: z.string().trim().min(1).optional(),
  templateType: z.enum(templateTypes),
  unit: z.enum(["m", "m2", "m3", "kg", "und", "glb", "p2", "ml", "pza", "bol", "gal", "ton", "mes", "día", "viaje", "pto", "jgo", "pln", "mll"]).optional(),
  name: z.string().trim().min(1).default("Nuevo metrado"),
});

export async function GET() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const accessResponse = await getFeatureAccessResponse(session.user.id, "metrados.advanced");
  if (accessResponse) return accessResponse;

  const sheets = await listMetradoSheetsByUser(session.user.id);
  return NextResponse.json({ sheets });
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const accessResponse = await getFeatureAccessResponse(session.user.id, "metrados.advanced");
  if (accessResponse) return accessResponse;

  try {
    const body = createSheetSchema.parse(await request.json());

    if (!body.budgetItemId) {
      return NextResponse.json(
        { error: "Selecciona una partida para vincular el metrado." },
        { status: 400 },
      );
    }

    const sheet = await createMetradoSheet({
      userId: session.user.id,
      projectId: body.projectId,
      budgetId: body.budgetId,
      budgetItemId: body.budgetItemId,
      templateType: body.templateType,
      unit: body.unit,
      name: body.name,
    });

    return NextResponse.json({ sheet }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Revisa los datos del metrado." }, { status: 400 });
    }

    if (isCreateSheetDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Metrado POST failed", error);
    return NextResponse.json({ error: "No se pudo crear el metrado." }, { status: 500 });
  }
}

function isCreateSheetDomainError(error: unknown): error is Error {
  if (!(error instanceof Error)) {
    return false;
  }

  return [
    "La plantilla de metrado seleccionada no existe.",
    "La partida seleccionada no pertenece al presupuesto elegido.",
    "No se pudo cargar el metrado creado.",
  ].includes(error.message);
}
