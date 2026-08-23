import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { requireWorkspaceOwner, WorkspaceAuthorizationError } from "@/lib/workspace/authorization";
import { createWorkspaceYapePaymentRequest, getYapePaymentConfig } from "@/lib/billing/yape";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: companyId } = await params;

  try {
    await requireWorkspaceOwner({ userId: session.user.id, companyId });
    const paymentRequest = await createWorkspaceYapePaymentRequest({ companyId });

    return NextResponse.json({
      requestId: paymentRequest.id,
      status: paymentRequest.status,
      createdAt: paymentRequest.createdAt.toISOString(),
      yape: getYapePaymentConfig(),
    });
  } catch (error) {
    const status = error instanceof WorkspaceAuthorizationError ? 403 : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar la solicitud Yape" },
      { status },
    );
  }
}
