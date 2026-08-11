import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getAvailableFeatures, type WorkspaceFeatureKey } from "@/lib/workspace/feature-registry";
import type { WorkspaceRole } from "@/types/workspace";

export class WorkspaceFeatureAccessError extends Error {
  readonly statusCode = 403;

  constructor(readonly feature: string) {
    super(`La funcionalidad "${feature}" no esta disponible en tu plan`);
    this.name = "WorkspaceFeatureAccessError";
  }
}

export function isWorkspaceFeatureAccessError(error: unknown): error is WorkspaceFeatureAccessError {
  return error instanceof WorkspaceFeatureAccessError;
}

const WORKSPACE_FEATURE_ACCESS_STATUS = 403;

export function getWorkspaceFeatureAccessStatus(error: unknown): number {
  return isWorkspaceFeatureAccessError(error) ? WORKSPACE_FEATURE_ACCESS_STATUS : 400;
}

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

  const [subscription, user] = await Promise.all([
    prisma.companySubscription.findUnique({
      where: { companyId },
      include: { membershipPlan: { select: { slug: true, name: true } } },
    }),
    prisma.user.findUnique({
      where: { id: options.userId },
      select: { membershipPlan: { select: { slug: true, name: true } } },
    }),
  ]);

  // Prefer the company subscription plan; fall back to the user's personal plan
  const effectivePlan = subscription?.membershipPlan ?? user?.membershipPlan;
  const planSlug = (effectivePlan?.slug as "starter" | "pro" | "empresa") ?? "starter";

  return {
    planSlug,
    planName: effectivePlan?.name ?? "Starter",
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
  license: { availableFeatures: WorkspaceFeatureKey[] } | null,
  feature: WorkspaceFeatureKey,
): boolean {
  if (!license) return false;
  return license.availableFeatures.includes(feature);
}

export async function assertWorkspaceFeatureAccess(options: {
  userId: string;
  companyId: string;
  feature: WorkspaceFeatureKey;
}) {
  const license = await getEffectiveWorkspaceLicense({
    userId: options.userId,
    companyId: options.companyId,
  });

  if (!license) {
    throw new Error("No tienes acceso a este workspace");
  }

  if (!license.availableFeatures.includes(options.feature)) {
    throw new WorkspaceFeatureAccessError(options.feature);
  }
}
