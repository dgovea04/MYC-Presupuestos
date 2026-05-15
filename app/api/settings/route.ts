import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { getUserSettings, updateUserSettings } from "@/lib/data/settings";
import { userSettingsSchema } from "@/lib/validations/settings";

const updateSettingsRequestSchema = userSettingsSchema.strict();
const VALIDATION_ERROR_MESSAGE = "Revisa los datos de configuración e intenta nuevamente.";
const SAVE_ERROR_MESSAGE = "No se pudo guardar la configuración";

export async function GET() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const settings = await getUserSettings(session.user.id);
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = updateSettingsRequestSchema.parse(body);
    const settings = await updateUserSettings(session.user.id, payload);

    revalidatePath("/dashboard");
    revalidatePath("/projects");
    revalidatePath("/budgets");
    revalidatePath("/resources");
    revalidatePath("/settings");

    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: VALIDATION_ERROR_MESSAGE }, { status: 400 });
    }

    return NextResponse.json({ error: SAVE_ERROR_MESSAGE }, { status: 400 });
  }
}
