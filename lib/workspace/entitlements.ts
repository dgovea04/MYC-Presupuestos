import { prisma } from "@/lib/db/prisma";
import { getAvailableFeatures } from "@/lib/workspace/feature-registry";
import type { WorkspaceContextEnvelope, WorkspaceRole } from "@/types/workspace";

export async function getEffectiveWorkspaceLicense(options: {
  userId: string;
  companyId: string;
}) {
  const membership = await prisma.companyMembership.findUnique({
    where: {
      companyId_userId: {
        companyId: options.companyId,
        userId: options.userId,
      },
    },
    select: { role: true, status: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return null;
  }

  const subscription = await prisma.companySubscription.findUnique({
    where: { companyId: options.companyId },
    include: { membershipPlan: { select: { slug: true, name: true } } },
  });

  const planSlug = (subscription?.membershipPlan?.slug as "starter" | "pro" | "empresa") ?? "starter";

  return {
    planSlug,
    planName: subscription?.membershipPlan?.name ?? "Starter",
    role: membership.role as WorkspaceRole,
    availableFeatures: getAvailableFeatures(planSlug),
  };
}

export async function assertWorkspaceFeatureAccess(options: {
  userId: string;
  companyId: string;
  feature: string;
}) {
  const license = await getEffectiveWorkspaceLicense({
    userId: options.userId,
    companyId: options.companyId,
  });

  if (!license) {
    throw new Error("No tienes acceso a este workspace");
  }

  if (!license.availableFeatures.includes(options.feature)) {
    throw new Error(`La funcionalidad "${options.feature}" no esta disponible en tu plan`);
  }
}
