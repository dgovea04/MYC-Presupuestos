import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { revokeAdminUserSessions } from "@/lib/data/admin-users";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession("users.revoke_sessions");

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    await revokeAdminUserSessions(id, session.user.id, getAdminActionContext(request));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cerrar las sesiones." },
      { status: 400 },
    );
  }
}

function getAdminActionContext(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}
