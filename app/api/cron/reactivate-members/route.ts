import { NextResponse } from "next/server";
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
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  // Accept secret via Bearer token OR query parameter (for Vercel Cron)
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get("secret");
  const auth = request.headers.get("Authorization");
  const bearerToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (bearerToken !== secret && querySecret !== secret) {
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
