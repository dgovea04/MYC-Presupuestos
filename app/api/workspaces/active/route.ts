import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeCompanyId = await getActiveWorkspaceId(session.user.id);
  return NextResponse.json({ activeCompanyId });
}
