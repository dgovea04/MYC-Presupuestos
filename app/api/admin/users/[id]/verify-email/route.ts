import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { verifyUserEmailManually } from "@/lib/data/admin-users";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession("users.verify_email");

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;

    await verifyUserEmailManually(id, session.user.id, getAdminActionContext(request));
    revalidatePath("/admin");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error inesperado" }, { status: 400 });
  }
}

function getAdminActionContext(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}
