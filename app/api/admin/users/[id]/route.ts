import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import { notifyPrimaryAdminSecurityEvent } from "@/lib/auth/admin-security-alert";
import { requestAdminUserDeletion } from "@/lib/data/admin-deletion-approvals";
import { updateUserAdminAccess } from "@/lib/data/admin-users";
import { adminUserAccessSchema } from "@/lib/validations/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession("users.manage_access");

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const data = adminUserAccessSchema.parse(await request.json());

    await updateUserAdminAccess(id, data, session.user.id, getAdminActionContext(request));
    revalidatePath("/admin");

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Revisa los datos del usuario e intenta nuevamente." }, { status: 400 });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Error inesperado" }, { status: 400 });
  }
}

const deleteUserSchema = z.object({
  confirmationEmail: z.string().trim().email(),
  reason: z.string().trim().min(10).max(500),
});

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession("users.delete_permanently", request);

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const payload = deleteUserSchema.parse(await request.json());

    const approval = await requestAdminUserDeletion(
      id,
      session.user.id,
      payload.confirmationEmail,
      payload.reason,
      getAdminActionContext(request),
    );
    await notifyPrimaryAdminSecurityEvent({
      action: "USER_DELETION_REQUESTED",
      actorEmail: session.user.email ?? session.user.id,
      targetEmail: approval.targetEmail,
      detail: `Solicitud de eliminación permanente creada. Motivo: ${payload.reason}`,
    });
    revalidatePath("/admin");

    return NextResponse.json({ ok: true, approvalId: approval.approvalId, expiresAt: approval.expiresAt.toISOString() }, { status: 202 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Escribe el correo y un motivo de al menos 10 caracteres para solicitar la eliminacion." }, { status: 400 });
    }

    return NextResponse.json(      { error: error instanceof Error ? error.message : "No se pudo crear la solicitud de eliminación." }, { status: 400 });
  }
}

function getAdminActionContext(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}
