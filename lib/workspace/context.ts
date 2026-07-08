import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import type { WorkspaceContextEnvelope, WorkspaceRole } from "@/types/workspace";

export const getWorkspaceContextForUser = cache(async function getWorkspaceContextForUser(
  userId: string,
): Promise<WorkspaceContextEnvelope | null> {
  const companyId = await getActiveWorkspaceId(userId);
  if (!companyId) return null;

  const membership = await prisma.companyMembership.findUnique({
    where: { companyId_userId: { companyId, userId } },
    select: {
      role: true,
      company: { select: { name: true, logoUrl: true } },
    },
  });

  if (!membership) return null;

  const subscription = await prisma.companySubscription.findUnique({
    where: { companyId },
    include: { membershipPlan: { select: { slug: true, name: true } } },
  });

  // For now, derive workspace context from membership + subscription
  // Feature flags will be centralized in Task 4
  return {
    workspace: {
      id: companyId,
      name: membership.company.name,
      role: membership.role as WorkspaceRole,
      logoUrl: membership.company.logoUrl,
    },
    featureFlags: [],
    planSlug: (subscription?.membershipPlan?.slug as "starter" | "pro" | "empresa") ?? "starter",
  };
});
