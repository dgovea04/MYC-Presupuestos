import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getAvailableFeatures } from "@/lib/workspace/feature-registry";
import type { WorkspaceContextEnvelope, WorkspaceRole } from "@/types/workspace";

const _getEffectiveWorkspaceLicense = async (options: {
  userId: string;
  companyId: string | null | undefined;
}) => {
  const companyId = options.companyId;
  if (!companyId) return null;

  const membership = await prisma.companyMembership.findUnique({
    where: {
      companyId_userId: {
        companyId,
        userId: options.userId,
      },
    },
    select: { role: true, status: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return null;
  }

  const subscription = await prisma.companySubscription.findUnique({
    where: { companyId },
    include: { membershipPlan: { select: { slug: true, name: true } } },
  });

  const planSlug = (subscription?.membershipPlan?.slug as "starter" | "pro" | "empresa") ?? "starter";

  return {
    planSlug,
    planName: subscription?.membershipPlan?.name ?? "Starter",
    role: membership.role as WorkspaceRole,
    availableFeatures: getAvailableFeatures(planSlug),
  };
};

export const getEffectiveWorkspaceLicense = cache(
  (options: { userId: string; companyId: string | null | undefined }) => {
    const key = `effective-license-${options.userId}-${options.companyId ?? "null"}`;
    return process.env.NODE_ENV === "development"
      ? _getEffectiveWorkspaceLicense(options)
      : unstable_cache(_getEffectiveWorkspaceLicense, [key], {
          tags: [key],
          revalidate: 300,
        })(options);
  },
);

export function hasFeatureAccess(
  license: { availableFeatures: string[] } | null,
  feature: string,
): boolean {
  if (!license) return false;
  return license.availableFeatures.includes(feature);
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
