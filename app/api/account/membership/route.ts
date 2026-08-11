import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { getUserAccountMembership } from "@/lib/data/account";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import { getEffectiveWorkspaceLicense } from "@/lib/workspace/entitlements";

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const activeWorkspaceId = await getActiveWorkspaceId(session.user.id);
  const license = await getEffectiveWorkspaceLicense({ userId: session.user.id, companyId: activeWorkspaceId });
  return NextResponse.json({
    ...(await getUserAccountMembership(session.user.id, activeWorkspaceId)),
    availableFeatures: license?.availableFeatures ?? [],
  });
}
