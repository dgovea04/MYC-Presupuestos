import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { consumePasswordResetToken } from "@/lib/auth/password-reset";
import { passwordResetSchema } from "@/lib/validations/account";

export async function POST(request: Request) {
  try {
    const payload = passwordResetSchema.parse(await request.json());
    const result = await consumePasswordResetToken(payload.token, payload.newPassword);

    if (result.status === "invalid") {
      return NextResponse.json({ error: "El enlace no es valido o ya vencio." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Revisa la nueva contrasena e intenta nuevamente." }, { status: 400 });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cambiar la contrasena." }, { status: 400 });
  }
}
