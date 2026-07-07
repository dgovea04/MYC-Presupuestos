import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await prisma.companyMembership.findMany({
    where: {
      userId: session.user.id,
      status: "INVITED",
    },
    include: {
      company: { select: { id: true, name: true, logoUrl: true } },
      invitedBy: { select: { name: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json({
    invitations: pending.map((m) => ({
      companyId: m.companyId,
      companyName: m.company.name,
      companyLogoUrl: m.company.logoUrl,
      role: m.role,
      invitedByName: m.invitedBy?.name ?? null,
      invitedAt: m.joinedAt.toISOString(),
    })),
  });
}
