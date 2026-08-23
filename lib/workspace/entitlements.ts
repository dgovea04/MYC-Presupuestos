import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getActiveBetaAccess, isBetaAccessActive } from "@/lib/beta/access";
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

  const [subscription, user, betaAccess, proPlan] = await Promise.all([
    prisma.companySubscription.findUnique({
      where: { companyId },
      include: { membershipPlan: { select: { slug: true, name: true, monthlyTokenLimit: true } } },
    }),
    prisma.user.findUnique({
      where: { id: options.userId },
      select: { membershipPlan: { select: { slug: true, name: true, monthlyTokenLimit: true } } },
    }),
    getActiveBetaAccess({ userId: options.userId, companyId }),
    prisma.membershipPlan.findUnique({
      where: { slug: "pro" },
      select: { slug: true, name: true, monthlyTokenLimit: true },
    }),
  ]);

  // Only confirmed subscriptions grant the company plan. A pending manual request
  // must remain visible to billing without unlocking Pro features.
  const activeCompanySubscription = subscription && (subscription.status === "ACTIVE" || subscription.status === "TRIALING")
    ? subscription
    : null;

  // Prefer the active company subscription plan; fall back to the user's personal plan.
  // A beta grant can elevate Starter access to Pro, but never replaces Pro/Empresa.
  const basePlan = activeCompanySubscription?.membershipPlan ?? user?.membershipPlan;
  const basePlanSlug = basePlan?.slug ?? "starter";
  const shouldUseBeta = basePlanSlug !== "pro" && basePlanSlug !== "empresa" && betaAccess !== null;
  const effectivePlan = shouldUseBeta
    ? { slug: "pro", name: "Pro Beta", monthlyTokenLimit: proPlan?.monthlyTokenLimit ?? 0 }
    : basePlan;
  const planSlug = (effectivePlan?.slug as "starter" | "pro" | "empresa") ?? "starter";
  const accessSource = shouldUseBeta
    ? "BETA"
    : activeCompanySubscription?.membershipPlan
      ? "COMPANY_SUBSCRIPTION"
      : user?.membershipPlan
        ? "PLAN"
        : "PLAN";

  return {
    planSlug,
    planName: effectivePlan?.name ?? "Starter",
    role: membership.role as WorkspaceRole,
    availableFeatures: getAvailableFeatures(planSlug),
    monthlyTokenLimit: effectivePlan?.monthlyTokenLimit ?? 0,
    accessSource,
    betaGrantId: shouldUseBeta ? betaAccess.grantId : null,
    betaCampaignName: shouldUseBeta ? betaAccess.campaignName : null,
    betaExpiresAt: shouldUseBeta ? betaAccess.expiresAt.toISOString() : null,
  };
};

export function getWorkspaceLicenseCacheTag(userId: string, companyId: string | null | undefined) {
  return `effective-license-${userId}-${companyId ?? "null"}`;
}

export const getEffectiveWorkspaceLicense = cache(
  (options: { userId: string; companyId: string | null | undefined }) => {
    const key = getWorkspaceLicenseCacheTag(options.userId, options.companyId);
    return process.env.NODE_ENV === "development"
      ? _getEffectiveWorkspaceLicense(options)
      : unstable_cache(_getEffectiveWorkspaceLicense, [key], {
          tags: [key],
          revalidate: 300,
        })(options);
  },
);

export function hasFeatureAccess(
  license: {
    availableFeatures: WorkspaceFeatureKey[];
    accessSource?: string;
    betaExpiresAt?: string | null;
  } | null,
  feature: WorkspaceFeatureKey,
): boolean {
  if (!license || !isBetaAccessActive(license)) return false;
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

  if (!hasFeatureAccess(license, options.feature)) {
    throw new WorkspaceFeatureAccessError(options.feature);
  }
}
