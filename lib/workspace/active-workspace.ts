import { cache } from "react";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import type { WorkspaceRole } from "@/types/workspace";

const ACTIVE_WORKSPACE_COOKIE = "myc_active_workspace";
export const WORKSPACE_LIST_CACHE_TAG = "user-workspaces";

export const getActiveWorkspaceId = cache(async function getActiveWorkspaceId(userId: string): Promise<string | null> {
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
});

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

type WorkspaceListEntry = { id: string; name: string; role: WorkspaceRole; logoUrl: string | null };

async function _listUserWorkspaces(userId: string) {
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
  })) satisfies WorkspaceListEntry[];
}

export const listUserWorkspaces = cache(
  (userId: string): Promise<WorkspaceListEntry[]> =>
    process.env.NODE_ENV === "development" || process.env.VITEST === "true"
      ? _listUserWorkspaces(userId)
      : unstable_cache(_listUserWorkspaces, [`${WORKSPACE_LIST_CACHE_TAG}-${userId}`], {
          tags: [WORKSPACE_LIST_CACHE_TAG, `${WORKSPACE_LIST_CACHE_TAG}-${userId}`],
          revalidate: 300,
        })(userId),
);
