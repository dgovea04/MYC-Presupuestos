import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const searchQuerySchema = z.object({
  q: z.string().trim().min(2, "Ingresa al menos 2 caracteres"),
});

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const rawQ = searchParams.get("q") ?? "";
  const parsed = searchQuerySchema.safeParse({ q: rawQ });

  if (!parsed.success) {
    return NextResponse.json({ users: [] });
  }

  const query = parsed.data.q;

  try {
    // Resolve the current user's company names via memberships to scope the search
    const userMemberships = await prisma.companyMembership.findMany({
      where: { userId: session.user.id, status: "ACTIVE" },
      select: { company: { select: { name: true } } },
    });
    const companyNames = [...new Set(userMemberships.map((m) => m.company.name))];

    // If the user has no companies, return empty — there is no "same company" to scope against
    if (companyNames.length === 0) {
      return NextResponse.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
        ],
        id: { not: session.user.id },
        companyMemberships: {
          some: {
            status: "ACTIVE",
            company: {
              name: { in: companyNames },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
      take: 8,
    });

    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ users: [] });
  }
}
