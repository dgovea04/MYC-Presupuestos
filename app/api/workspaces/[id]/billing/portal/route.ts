import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { createWorkspaceBillingPortalSession } from "@/lib/billing/stripe";
import { requireWorkspaceOwner, WorkspaceAuthorizationError } from "@/lib/workspace/authorization";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: companyId } = await params;
  try {
    await requireWorkspaceOwner({ userId: session.user.id, companyId });
  } catch (error) {
    const message = error instanceof WorkspaceAuthorizationError ? error.message : "No tienes permisos para gestionar la facturación";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  try {
    const portalSession = await createWorkspaceBillingPortalSession({ companyId });
    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo abrir el portal de facturacion" },
      { status: 400 },
    );
  }
}
