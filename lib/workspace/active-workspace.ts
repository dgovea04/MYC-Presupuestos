import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import type { WorkspaceRole } from "@/types/workspace";

const ACTIVE_WORKSPACE_COOKIE = "myc_active_workspace";

export async function getActiveWorkspaceId(userId: string): Promise<string | null> {
  const cookieStore = await cookies();
  const stored = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;

  // Validate the stored workspace still belongs to the user
  if (stored) {
    const membership = await prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId: stored, userId } },
      select: { status: true },
    });

    if (membership && membership.status === "ACTIVE") {
      return stored;
    }
  }

  // Fallback: pick the first active membership
  const first = await prisma.companyMembership.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { joinedAt: "asc" },
    select: { companyId: true },
  });

  return first?.companyId ?? null;
}

export async function setActiveWorkspaceId(userId: string, companyId: string): Promise<void> {
  const membership = await prisma.companyMembership.findUnique({
    where: { companyId_userId: { companyId, userId } },
    select: { status: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("No perteneces a este workspace");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, companyId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function listUserWorkspaces(userId: string): Promise<
  { id: string; name: string; role: WorkspaceRole; logoUrl: string | null }[]
> {
  const memberships = await prisma.companyMembership.findMany({
    where: { userId, status: "ACTIVE" },
    include: {
      company: {
        select: { name: true, logoUrl: true },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  return memberships.map((m) => ({
    id: m.companyId,
    name: m.company.name,
    role: m.role as WorkspaceRole,
    logoUrl: m.company.logoUrl,
  }));
}
