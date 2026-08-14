import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import { deleteAdminUserPermanently, updateUserAdminAccess } from "@/lib/data/admin-users";
import { adminUserAccessSchema } from "@/lib/validations/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();

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
});

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const payload = deleteUserSchema.parse(await request.json());

    await deleteAdminUserPermanently(id, session.user.id, payload.confirmationEmail, getAdminActionContext(request));
    revalidatePath("/admin");

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Escribe el correo del usuario para confirmar la eliminacion." }, { status: 400 });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar el usuario." }, { status: 400 });
  }
}

function getAdminActionContext(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}
