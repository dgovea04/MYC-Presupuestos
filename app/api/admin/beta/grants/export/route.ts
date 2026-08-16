import { NextResponse } from "next/server";
import { BetaGrantSource, BetaGrantStatus } from "@prisma/client";
import { requireAdminSession } from "@/lib/auth/session";
import { consumeRateLimit, getRateLimitHeaders, getRequestClientIp } from "@/lib/auth/rate-limit";
import {
  BETA_GRANTS_EXPORT_PAGE_SIZE,
  listBetaGrants,
} from "@/lib/beta/campaigns";
import { recordAdminAudit } from "@/lib/data/admin-audit";

export async function GET(request: Request) {
  const session = await requireAdminSession("beta.export", request);

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimit = await consumeRateLimit({
    key: `admin-beta-export:${session.user.id}:${getRequestClientIp(request)}`,
    maxAttempts: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas exportaciones. Intenta nuevamente más tarde." },
      { status: 429, headers: getRateLimitHeaders(rateLimit) },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const campaignId = searchParams.get("campaignId")?.trim();
  if (!campaignId) {
    return NextResponse.json({ error: "La campaña beta es obligatoria." }, { status: 400 });
  }

  const status = parseEnum(searchParams.get("status"), Object.values(BetaGrantStatus));
  const source = parseEnum(searchParams.get("source"), Object.values(BetaGrantSource));
  const result = await listBetaGrants({
    campaignId,
    query: searchParams.get("q") ?? undefined,
    status,
    source,
    page: 1,
    pageSize: BETA_GRANTS_EXPORT_PAGE_SIZE,
  });
  const csv = buildBetaGrantsCsv(result.grants);

  await recordAdminAudit({
    actorUserId: session.user.id,
    targetUserId: null,
    targetEmail: session.user.email ?? "sistema",
    action: "BETA_GRANTS_EXPORTED",
    detail: "Exportación CSV de grants beta.",
    metadata: {
      campaignId,
      query: searchParams.get("q")?.trim() || null,
      status: status ?? null,
      source: source ?? null,
      exportedRows: result.grants.length,
    },
    ...getAdminActionContext(request),
  });

  return new NextResponse(`\uFEFF${csv}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mc-presupuestos-beta-grants-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function buildBetaGrantsCsv(
  grants: Awaited<ReturnType<typeof listBetaGrants>>["grants"],
) {
  const rows: string[][] = [
    ["Grant", "Usuario", "Correo", "Empresa", "Estado", "Origen", "Inicio", "Vencimiento", "Revocado"],
    ...grants.map((grant) => [
      grant.id,
      grant.user.name,
      grant.user.email,
      grant.companyId ?? "",
      grant.status,
      grant.source,
      grant.startsAt.toISOString(),
      grant.expiresAt.toISOString(),
      grant.revokedAt?.toISOString() ?? "",
    ]),
  ];

  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
}

function escapeCsvValue(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function parseEnum<T extends string>(value: string | null, values: readonly T[]) {
  return values.includes(value as T) ? (value as T) : undefined;
}

function getAdminActionContext(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}
