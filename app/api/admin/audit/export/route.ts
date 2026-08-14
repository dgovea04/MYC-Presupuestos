import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { consumeRateLimit, getRateLimitHeaders, getRequestClientIp } from "@/lib/auth/rate-limit";
import {
  ADMIN_AUDIT_EXPORT_PAGE_SIZE,
  listAdminAuditLogs,
  normalizeAdminAuditAction,
  normalizeAdminAuditQuery,
} from "@/lib/data/admin-audit";

export async function GET(request: Request) {
  const session = await requireAdminSession("audit.read");

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimit = await consumeRateLimit({
    key: `admin-audit-export:${session.user.id}:${getRequestClientIp(request)}`,
    maxAttempts: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Demasiadas exportaciones. Intenta nuevamente más tarde." }, { status: 429, headers: getRateLimitHeaders(rateLimit) });
  }

  const searchParams = new URL(request.url).searchParams;
  const result = await listAdminAuditLogs({
    query: normalizeAdminAuditQuery(searchParams.get("q") ?? undefined),
    action: normalizeAdminAuditAction(searchParams.get("action") ?? undefined),
    page: 1,
    pageSize: ADMIN_AUDIT_EXPORT_PAGE_SIZE,
  });
  const csv = [
    ["Fecha", "Accion", "Objetivo", "Administrador", "Detalle"],
    ...result.entries.map((entry) => [
      entry.createdAt,
      entry.action,
      entry.targetEmail,
      entry.actorEmail ?? "Sistema",
      entry.detail ?? "",
    ]),
  ]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n");

  return new NextResponse(`\uFEFF${csv}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mc-presupuestos-auditoria-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function escapeCsvValue(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
