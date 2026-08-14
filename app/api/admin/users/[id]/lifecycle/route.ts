import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import { updateAdminUserStatus } from "@/lib/data/admin-users";

const lifecycleSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession("users.manage_lifecycle");

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const payload = lifecycleSchema.parse(await request.json());

    await updateAdminUserStatus(id, payload.status, session.user.id, getAdminActionContext(request));
    revalidatePath("/admin");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el estado." }, { status: 400 });
  }
}

function getAdminActionContext(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}
