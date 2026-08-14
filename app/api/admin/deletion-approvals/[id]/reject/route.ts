import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { rejectAdminUserDeletion } from "@/lib/data/admin-deletion-approvals";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession("users.approve_deletion");

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    await rejectAdminUserDeletion(id, session.user.id, getAdminActionContext(request));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo rechazar la eliminación." },
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
