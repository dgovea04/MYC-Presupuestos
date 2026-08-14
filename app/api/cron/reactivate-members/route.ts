import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth/cron-auth";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/cron/reactivate-members
 *
 * Cron endpoint that proactively reactivates expired suspensions across all workspaces.
 * Protected by CRON_SECRET via Bearer token OR query parameter (for Vercel Cron).
 *
 * Usage:
 *   curl -H "Authorization: Bearer <CRON_SECRET>" https://.../api/cron/reactivate-members
 *   curl https://.../api/cron/reactivate-members?secret=<CRON_SECRET>
 */
export async function GET(request: Request) {
  const authorization = isAuthorizedCronRequest(request);

  if (!authorization.configured) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  if (!authorization.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const result = await prisma.companyMembership.updateMany({
    where: {
      status: "SUSPENDED",
      suspendedUntil: { not: null, lte: now },
    },
    data: {
      status: "ACTIVE",
      suspendedUntil: null,
    },
  });

  return NextResponse.json({
    reactivated: result.count,
    checkedAt: now.toISOString(),
  });
}
