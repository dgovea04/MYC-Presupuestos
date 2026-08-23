import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { requireWorkspaceOwner, WorkspaceAuthorizationError } from "@/lib/workspace/authorization";
import { prisma } from "@/lib/db/prisma";
import { storeYapeReceipt } from "@/lib/storage/yape-receipts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: companyId } = await params;

  try {
    await requireWorkspaceOwner({ userId: session.user.id, companyId });

    const subscription = await prisma.companySubscription.findFirst({
      where: { companyId, provider: "MANUAL", status: "INCOMPLETE" },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    if (!subscription) {
      return NextResponse.json({ error: "No hay una solicitud Yape pendiente para este espacio de trabajo." }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Comprobante requerido." }, { status: 400 });
    }

    const stored = await storeYapeReceipt(subscription.id, file);

    await prisma.companySubscription.update({
      where: { id: subscription.id },
      data: {
        receiptUrl: stored.filePath,
        receiptUploadedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, receiptUrl: stored.filePath });
  } catch (error) {
    const status = error instanceof WorkspaceAuthorizationError ? 403 : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo subir el comprobante." },
      { status },
    );
  }
}