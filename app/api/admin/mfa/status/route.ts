import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminMfaStatus } from "@/lib/auth/admin-mfa";

export async function GET() {
  const session = await requireAdminSession("security.manage");

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = await getAdminMfaStatus(session.user.id);
  return NextResponse.json(status);
}
