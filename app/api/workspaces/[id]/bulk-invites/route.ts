import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { assertWorkspaceFeatureAccess } from "@/lib/workspace/entitlements";
import { WorkspaceAuthorizationError } from "@/lib/workspace/authorization";
import { bulkInviteWorkspaceMembers } from "@/lib/workspace/invitations";
import { WorkspaceSeatLimitError } from "@/lib/workspace/seats";
import { bulkInviteWorkspaceSchema } from "@/lib/validations/workspace";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: companyId } = await params;

  try {
    await assertWorkspaceFeatureAccess({ userId: session.user.id, companyId, feature: "workspace.management" });
  } catch {
    return NextResponse.json({ error: "No tienes acceso a este workspace" }, { status: 403 });
  }

  const parsed = bulkInviteWorkspaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ingresa al menos un email válido" }, { status: 400 });

  try {
    const result = await bulkInviteWorkspaceMembers({
      companyId,
      actorUserId: session.user.id,
      emailsText: parsed.data.emailsText,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WorkspaceAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof WorkspaceSeatLimitError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    throw error;
  }
}
