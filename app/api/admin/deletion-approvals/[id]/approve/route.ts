import { NextResponse } from "next/server";
import { notifyPrimaryAdminSecurityEvent } from "@/lib/auth/admin-security-alert";
import { requireAdminSession } from "@/lib/auth/session";
import { approveAdminUserDeletion } from "@/lib/data/admin-deletion-approvals";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession("users.approve_deletion");

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const result = await approveAdminUserDeletion(id, session.user.id, getAdminActionContext(request));
    await notifyPrimaryAdminSecurityEvent({
      action: "USER_DELETION_SCHEDULED",
      actorEmail: session.user.email ?? session.user.id,
      targetEmail: result.targetEmail,
      detail: `Eliminación programada para ${result.scheduledAt.toISOString()} después de una aprobación de dos pasos. Motivo: ${result.reason}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo aprobar la eliminación." },
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
