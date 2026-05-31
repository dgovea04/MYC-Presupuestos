import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import { recordActivityEvent } from "@/lib/data/activity-events";
import { duplicateMetradoSheet } from "@/lib/data/metrados";

const duplicateSheetSchema = z.object({
  name: z.string().trim().min(1).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = duplicateSheetSchema.parse(await request.json().catch(() => ({})));
    const sheet = await duplicateMetradoSheet({
      sourceSheetId: id,
      userId: session.user.id,
      name: body.name,
    });

    await safelyRecordMetradoDuplicateActivity(session.user.id, sheet.name);
    revalidatePath("/dashboard");
    revalidatePath("/metrados-avanzados");

    return NextResponse.json({ sheet }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Revisa los datos para duplicar el metrado." }, { status: 400 });
    }

    if (isDuplicateSheetDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Metrado duplicate POST failed", error);
    return NextResponse.json({ error: "No se pudo duplicar el metrado." }, { status: 500 });
  }
}

async function safelyRecordMetradoDuplicateActivity(userId: string, sheetName: string) {
  try {
    await recordActivityEvent({
      userId,
      type: "BUDGET_UPDATED",
      title: "Metrado duplicado",
      detail: `${sheetName} creado como base reutilizable`,
      href: "/metrados-avanzados",
    });
  } catch {
    // Activity logging should not turn a successful metrado duplication into an API failure.
  }
}

function isDuplicateSheetDomainError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    [
      "Metrado no encontrado.",
      "El metrado de origen no tiene partida vinculada.",
      "La plantilla de metrado seleccionada no existe.",
      "La partida seleccionada no pertenece al presupuesto elegido.",
      "No se pudo cargar el metrado creado.",
      "No se pudo cargar el metrado duplicado.",
      "No se pueden guardar filas de metrado con errores de validacion.",
    ].includes(error.message)
  );
}
