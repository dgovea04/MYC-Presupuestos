import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { assertWorkspaceFeatureAccess } from "@/lib/workspace/entitlements";
import { requireWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/workspace/authorization";
import { listWorkspaceAuditEvents } from "@/lib/workspace/audit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: companyId } = await params;
  try {
    await assertWorkspaceFeatureAccess({ userId: session.user.id, companyId, feature: "workspace.management" });
    await requireWorkspaceRole({ userId: session.user.id, companyId, minimumRole: "ADMIN" });
  } catch (error) {
    const message = error instanceof WorkspaceAuthorizationError ? error.message : "No tienes permisos para ver la auditoría";
    return NextResponse.json({ error: message }, { status: 403 });
  }
  const url = new URL(request.url);
  const takeValue = Number(url.searchParams.get("take") ?? "50");
  const events = await listWorkspaceAuditEvents({
    companyId,
    take: Number.isFinite(takeValue) ? takeValue : 50,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  return NextResponse.json({
    events,
    nextCursor: events.length === Math.min(Math.max(Number.isFinite(takeValue) ? takeValue : 50, 1), 100) ? events.at(-1)?.id ?? null : null,
  });
}
