import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import { getFeatureAccessResponse } from "@/lib/billing/route-access";
import { setMetradoSheetActiveState } from "@/lib/data/metrados";

const bodySchema = z.object({ isActive: z.boolean() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const accessResponse = await getFeatureAccessResponse(session.user.id, "metrados.advanced");
  if (accessResponse) return accessResponse;

  try {
    const body = bodySchema.parse(await request.json());
    const { id } = await params;
    const sheet = await setMetradoSheetActiveState({
      sheetId: id,
      userId: session.user.id,
      isActive: body.isActive,
    });

    if (!sheet) return NextResponse.json({ error: "Metrado no encontrado." }, { status: 404 });
    return NextResponse.json({ sheet });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "El estado de la hoja no es válido." }, { status: 400 });
    }
    console.error("Metrado active state PATCH failed", error);
    return NextResponse.json({ error: "No se pudo actualizar el estado de la hoja." }, { status: 400 });
  }
}
