import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { revokeAgentDelegation } from "@/lib/ai/agent/delegation-service";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; delegationId: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: workspaceId, delegationId } = await params;
  try {
    const delegation = await revokeAgentDelegation({ actorUserId: session.user.id, workspaceId, delegationId });
    return NextResponse.json({ delegation });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo revocar la delegación." }, { status: 403 }); }
}
