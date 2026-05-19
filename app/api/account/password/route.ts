import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { AccountCurrentPasswordError, updateUserPassword } from "@/lib/data/account";
import { accountPasswordSchema } from "@/lib/validations/account";

const PASSWORD_VALIDATION_ERROR = "Revisa los datos de seguridad e intenta nuevamente.";
const PASSWORD_SAVE_ERROR = "No se pudo actualizar la contrasena.";

export async function PATCH(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = accountPasswordSchema.parse(body);

    await updateUserPassword(session.user.id, payload);

    revalidatePath("/account");

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AccountCurrentPasswordError) {
      return NextResponse.json({ error: error.message || "La contrasena actual no es correcta." }, { status: 400 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: PASSWORD_VALIDATION_ERROR }, { status: 400 });
    }

    return NextResponse.json({ error: PASSWORD_SAVE_ERROR }, { status: 400 });
  }
}
