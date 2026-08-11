import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { issueEmailVerification } from "@/lib/auth/email-verification";
import { registerSchema } from "@/lib/validations/auth";
import { hashPassword } from "@/lib/auth/password";
import { registerUserWithCompany } from "@/lib/auth/registration";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Revisa los datos ingresados." },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
      select: { email: true, passwordHash: true },
    });

    if (existingUser) {
      if (!existingUser.passwordHash) {
        return NextResponse.json(
          {
            error:
              "Este correo ya esta registrado mediante Google. Continua con Google para iniciar sesion.",
          },
          { status: 409 },
        );
      }

      return NextResponse.json({ error: "Ese correo ya esta registrado" }, { status: 409 });
    }

    const registration = await registerUserWithCompany({
      name: data.name,
      email: data.email,
      passwordHash: await hashPassword(data.password),
      companyName: data.companyName,
      ruc: data.ruc || undefined,
    });

    let verificationEmailSent = true;

    try {
      await issueEmailVerification({
        userId: registration.user.id,
        email: data.email,
        name: data.name,
      });
    } catch {
      verificationEmailSent = false;
    }

    return NextResponse.json(
      {
        ok: true,
        requiresEmailVerification: true,
        verificationEmailSent,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error inesperado" }, { status: 400 });
  }
}
