import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/cron/reactivate-members
 *
 * Cron endpoint that proactively reactivates expired suspensions across all workspaces.
 * Protected by a CRON_SECRET shared secret header.
 *
 * Expected caller: Vercel Cron Jobs, GitHub Actions, or any external scheduler.
 * Usage: curl -H "Authorization: Bearer <CRON_SECRET>" https://.../api/cron/reactivate-members
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  const auth = request.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token !== secret) {
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
