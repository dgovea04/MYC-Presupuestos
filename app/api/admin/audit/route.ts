import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import {
  listAdminAuditLogs,
  normalizeAdminAuditAction,
  normalizeAdminAuditPage,
  normalizeAdminAuditPageSize,
  normalizeAdminAuditQuery,
} from "@/lib/data/admin-audit";

export async function GET(request: Request) {
  const session = await requireAdminSession("audit.read");

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const result = await listAdminAuditLogs({
    query: normalizeAdminAuditQuery(searchParams.get("q") ?? undefined),
    action: normalizeAdminAuditAction(searchParams.get("action") ?? undefined),
    page: normalizeAdminAuditPage(Number(searchParams.get("page") ?? "1")),
    pageSize: normalizeAdminAuditPageSize(Number(searchParams.get("pageSize") ?? "20")),
  });

  return NextResponse.json(result);
}
