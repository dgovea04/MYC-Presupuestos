import { NextResponse } from "next/server";
import { resendEmailVerification } from "@/lib/auth/email-verification";
import { resendVerificationSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = resendVerificationSchema.parse(body);
    const result = await resendEmailVerification(data.email);

    return NextResponse.json({ ok: true, sent: result.sent });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error inesperado" }, { status: 400 });
  }
}
