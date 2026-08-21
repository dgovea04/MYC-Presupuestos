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
      where: { companyId_userId: { companyId: stored, userId }, company: { deletedAt: null } },
      select: { status: true },
    });

    if (membership && membership.status === "ACTIVE") {
      return stored;
    }
  }

  const ownedWorkspace = await prisma.companyMembership.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      role: "OWNER",
      company: { userId, deletedAt: null },
    },
    orderBy: { joinedAt: "asc" },
    select: { companyId: true },
  });

  if (ownedWorkspace) {
    return ownedWorkspace.companyId;
  }

  // Fallback: pick the first active membership
  const first = await prisma.companyMembership.findFirst({
    where: { userId, status: "ACTIVE", company: { deletedAt: null } },
    orderBy: { joinedAt: "asc" },
    select: { companyId: true },
  });

  return first?.companyId ?? null;
});

export async function setActiveWorkspaceId(userId: string, companyId: string): Promise<void> {
  const membership = await prisma.companyMembership.findUnique({
    where: { companyId_userId: { companyId, userId }, company: { deletedAt: null } },
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
    where: { userId, status: "ACTIVE", company: { deletedAt: null } },
    include: {
      company: {
        select: { name: true, logoUrl: true, userId: true },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  return [...memberships].sort((left, right) => {
    const leftIsOwned = left.company.userId === userId;
    const rightIsOwned = right.company.userId === userId;

    if (leftIsOwned !== rightIsOwned) {
      return leftIsOwned ? -1 : 1;
    }

    if (left.role !== right.role) {
      if (left.role === "OWNER") return -1;
      if (right.role === "OWNER") return 1;
    }

    return 0;
  }).map((m) => ({
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
