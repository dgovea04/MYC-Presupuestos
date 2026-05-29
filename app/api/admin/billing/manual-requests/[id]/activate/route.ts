import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/session";
import { activateManualProRequest } from "@/lib/data/admin-users";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    await activateManualProRequest(id);
    revalidatePath("/admin");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo activar la solicitud manual" },
      { status: 400 },
    );
  }
}
