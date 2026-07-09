import { prisma as defaultPrisma } from "@/lib/db/prisma";

export const PRO_FEATURES = [
  "ai.local",
  "khipu.agent",
  "partidas.similarity",
  "work_schedule.intelligent",
  "polynomial_formula.adjustments",
  "risk_analysis",
  "exports.advanced",
] as const;

export const BASIC_FEATURES = ["exports.basic", "polynomial_formula"] as const;

export type ProFeatureKey = (typeof PRO_FEATURES)[number];
export type BasicFeatureKey = (typeof BASIC_FEATURES)[number];
export type FeatureKey = ProFeatureKey | BasicFeatureKey;
export type LimitedResource = "projects" | "budgets";

type BillingSubscriptionStatus =
  | "ACTIVE"
  | "TRIALING"
  | "PAST_DUE"
  | "CANCELED"
  | "UNPAID"
  | "INCOMPLETE"
  | "INCOMPLETE_EXPIRED";

type MembershipPlanRecord = {
  name: string;
  slug: string;
  projectLimit: number | null;
  budgetLimit: number | null;
  entitlements: string[];
};

type BillingSubscriptionRecord = {
  provider: "STRIPE" | "MANUAL";
  status: BillingSubscriptionStatus;
  pastDueStartedAt: Date | null;
};

type EntitlementUserRecord = {
  id: string;
  membershipPlan: MembershipPlanRecord | null;
  billingSubscriptions: BillingSubscriptionRecord[];
  companies: Array<{
    _count: {
      projects: number;
    };
  }>;
};

export type EffectiveUserLicense = {
  availableFeatures: FeatureKey[];
  budgetLimit: number | null;
  budgetUsage: number;
  isInGracePeriod: boolean;
  planName: string;
  planSlug: "starter" | "pro" | "empresa";
  projectLimit: number | null;
  projectUsage: number;
};

type EntitlementPrismaClient = {
  user: {
    findUnique: (args: {
      where: { id: string };
      select: {
        id: true;
        membershipPlan: {
          select: {
            name: true;
            slug: true;
            projectLimit: true;
            budgetLimit: true;
            entitlements: true;
          };
        };
        billingSubscriptions: {
          select: {
            provider: true;
            status: true;
            pastDueStartedAt: true;
          };
          orderBy: { updatedAt: "desc" };
          take: 1;
        };
        companies: {
          select: {
            _count: {
              select: {
                projects: true;
              };
            };
          };
        };
      };
    }) => Promise<EntitlementUserRecord | null>;
  };
  budget: {
    count: (args: {
      where: {
        kind: "GENERAL";
        project: {
          company: {
            memberships: {
              some: {
                userId: string;
                status: "ACTIVE";
              };
            };
          };
        };
      };
    }) => Promise<number>;
  };
};

export class FeatureAccessError extends Error {
  constructor(readonly feature: FeatureKey) {
    super("Esta funcionalidad esta disponible en Pro.");
    this.name = "FeatureAccessError";
  }
}

export class PlanLimitError extends Error {
  constructor(
    readonly resource: LimitedResource,
    readonly limit: number,
    readonly usage: number,
  ) {
    super(resource === "projects" ? "Alcanzaste el limite de proyectos Starter." : "Alcanzaste el limite de presupuestos Starter.");
    this.name = "PlanLimitError";
  }
}

const STARTER_LIMITS = {
  budgetLimit: 5,
  projectLimit: 3,
} as const;
const PAST_DUE_GRACE_DAYS = 3;

export function hasFeatureAccess(license: EffectiveUserLicense, feature: FeatureKey) {
  return license.availableFeatures.includes(feature);
}

export async function assertFeatureAccess({
  feature,
  now,
  prisma = defaultPrisma as unknown as EntitlementPrismaClient,
  userId,
}: {
  feature: FeatureKey;
  now?: Date;
  prisma?: EntitlementPrismaClient;
  userId: string;
}) {
  const license = await getEffectiveUserLicense({ now, prisma, userId });

  if (!hasFeatureAccess(license, feature)) {
    throw new FeatureAccessError(feature);
  }

  return license;
}

export async function assertWithinPlanLimit({
  now,
  prisma = defaultPrisma as unknown as EntitlementPrismaClient,
  resource,
  userId,
}: {
  now?: Date;
  prisma?: EntitlementPrismaClient;
  resource: LimitedResource;
  userId: string;
}) {
  const license = await getEffectiveUserLicense({ now, prisma, userId });
  const limit = resource === "projects" ? license.projectLimit : license.budgetLimit;
  const usage = resource === "projects" ? license.projectUsage : license.budgetUsage;

  if (limit !== null && usage >= limit) {
    throw new PlanLimitError(resource, limit, usage);
  }
}

export async function getEffectiveUserLicense({
  now = new Date(),
  prisma = defaultPrisma as unknown as EntitlementPrismaClient,
  userId,
}: {
  now?: Date;
  prisma?: EntitlementPrismaClient;
  userId: string;
}): Promise<EffectiveUserLicense> {
  const [user, budgetUsage] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        membershipPlan: {
          select: {
            name: true,
            slug: true,
            projectLimit: true,
            budgetLimit: true,
            entitlements: true,
          },
        },
        billingSubscriptions: {
          select: {
            provider: true,
            status: true,
            pastDueStartedAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
        companies: {
          select: {
            _count: {
              select: {
                projects: true,
              },
            },
          },
        },
      },
    }),
    prisma.budget.count({
      where: {
        kind: "GENERAL",
        project: {            company: {
              memberships: {
                some: {
                  userId,
                  status: "ACTIVE",
                },
              },
            },
        },
      },
    }),
  ]);

  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  const projectUsage = user.companies.reduce((total, company) => total + company._count.projects, 0);
  const billingSubscription = user.billingSubscriptions[0];
  const billingAccess = resolveBillingAccess(billingSubscription, now);
  const manualEmpresa = user.membershipPlan?.slug === "empresa";

  if (manualEmpresa || billingAccess.hasProAccess) {
    return {
      availableFeatures: [...BASIC_FEATURES, ...PRO_FEATURES],
      budgetLimit: null,
      budgetUsage,
      isInGracePeriod: billingAccess.isInGracePeriod,
      planName: manualEmpresa ? "Empresa" : "Pro",
      planSlug: manualEmpresa ? "empresa" : "pro",
      projectLimit: null,
      projectUsage,
    };
  }

  return {
    availableFeatures: resolveStarterFeatures(user.membershipPlan),
    budgetLimit: user.membershipPlan?.budgetLimit ?? STARTER_LIMITS.budgetLimit,
    budgetUsage,
    isInGracePeriod: false,
    planName: "Starter",
    planSlug: "starter",
    projectLimit: user.membershipPlan?.projectLimit ?? STARTER_LIMITS.projectLimit,
    projectUsage,
  };
}

function resolveBillingAccess(subscription: BillingSubscriptionRecord | undefined, now: Date) {
  if (!subscription) {
    return { hasProAccess: false, isInGracePeriod: false };
  }

  if (subscription.provider === "MANUAL") {
    return { hasProAccess: subscription.status === "ACTIVE" || subscription.status === "TRIALING", isInGracePeriod: false };
  }

  if (subscription.status === "ACTIVE" || subscription.status === "TRIALING") {
    return { hasProAccess: true, isInGracePeriod: false };
  }

  if (subscription.status !== "PAST_DUE") {
    return { hasProAccess: false, isInGracePeriod: false };
  }

  const pastDueStartedAt = subscription.pastDueStartedAt;
  if (!pastDueStartedAt) {
    return { hasProAccess: true, isInGracePeriod: true };
  }

  const elapsedMs = now.getTime() - pastDueStartedAt.getTime();
  const graceMs = PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;
  const inGrace = elapsedMs <= graceMs;

  return { hasProAccess: inGrace, isInGracePeriod: inGrace };
}

function resolveStarterFeatures(plan: MembershipPlanRecord | null): FeatureKey[] {
  const entitlements = plan?.entitlements.filter(isFeatureKey) ?? [];

  return [...new Set<FeatureKey>([...BASIC_FEATURES, ...entitlements])];
}

function isFeatureKey(value: string): value is FeatureKey {
  return (BASIC_FEATURES as readonly string[]).includes(value) || (PRO_FEATURES as readonly string[]).includes(value);
}
