import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { requireWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/workspace/authorization";
import { getWorkspaceUsage } from "@/lib/workspace/usage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: companyId } = await params;
  try {
    const { role } = await requireWorkspaceRole({ userId: session.user.id, companyId, minimumRole: "ADMIN" });
    return NextResponse.json({ ...(await getWorkspaceUsage(companyId)), canManageBilling: role === "OWNER" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof WorkspaceAuthorizationError ? error.message : "No se pudo cargar el uso del workspace" }, { status: 403 });
  }
}
