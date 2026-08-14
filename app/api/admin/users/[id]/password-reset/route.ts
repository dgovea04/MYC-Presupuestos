import { NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/auth/session";
import { requestAdminPasswordReset } from "@/lib/data/admin-users";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSuperAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const result = await requestAdminPasswordReset(id, session.user.id, getAdminActionContext(request));

    return NextResponse.json({ ok: true, expiresAt: result.expiresAt.toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo enviar el enlace." }, { status: 400 });
  }
}

function getAdminActionContext(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}
