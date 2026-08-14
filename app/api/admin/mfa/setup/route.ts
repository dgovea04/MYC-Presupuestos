import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { beginAdminMfaSetup } from "@/lib/auth/admin-mfa";

export async function POST() {
  const session = await requireAdminSession("security.manage");

  if (!session || !session.user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const setup = await beginAdminMfaSetup(session.user.id, session.user.email);
    return NextResponse.json(setup);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo iniciar MFA." }, { status: 400 });
  }
}
