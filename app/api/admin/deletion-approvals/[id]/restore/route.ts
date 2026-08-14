import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { notifyPrimaryAdminSecurityEvent } from "@/lib/auth/admin-security-alert";
import { requireAdminSession } from "@/lib/auth/session";
import { restoreAdminUserDeletion } from "@/lib/data/admin-deletion-approvals";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession("users.delete_permanently", request);

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const result = await restoreAdminUserDeletion(id, session.user.id, getAdminActionContext(request));

    await notifyPrimaryAdminSecurityEvent({
      action: "USER_DELETION_RESTORED",
      actorEmail: session.user.email ?? session.user.id,
      targetEmail: result.targetEmail,
      detail: `La cuenta fue restaurada durante el periodo de gracia de 30 días. Solicitud: ${id}.`,
    });
    revalidatePath("/admin");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo restaurar la cuenta." },
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
