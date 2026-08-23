import { prisma as defaultPrisma } from "@/lib/db/prisma";
import { PRO_FOUNDER_OFFER_CODE, PRO_FOUNDER_YAPE_AMOUNT } from "@/lib/billing/pricing";

type YapePrismaClient = {
  membershipPlan: {
    findUnique: (args: { where: { slug: "pro" } }) => Promise<{ id: string } | null>;
  };
  companySubscription: {
    create: (args: {
      data: {
        companyId: string;
        membershipPlanId: string;
        provider: "MANUAL";
        status: "INCOMPLETE";
      };
      select: {
        id: true;
        createdAt: true;
        status: true;
      };
    }) => Promise<{ id: string; createdAt: Date; status: "INCOMPLETE" }>;
    findFirst: (args: {
      where: {
        companyId: string;
        provider: "MANUAL";
        status: "INCOMPLETE";
      };
      select: {
        id: true;
        createdAt: true;
        status: true;
      };
      orderBy: { createdAt: "desc" };
    }) => Promise<{ id: string; createdAt: Date; status: "INCOMPLETE" } | null>;
  };
  billingSubscription: {
    create: (args: {
      data: {
        provider: "MANUAL";
        status: "INCOMPLETE";
        userId: string;
      };
      select: {
        id: true;
        createdAt: true;
        status: true;
      };
    }) => Promise<{ id: string; createdAt: Date; status: "INCOMPLETE" }>;
    findFirst: (args: {
      where: {
        provider: "MANUAL";
        status: "INCOMPLETE";
        userId: string;
      };
      select: {
        id: true;
        createdAt: true;
        status: true;
      };
      orderBy: { createdAt: "desc" };
    }) => Promise<{ id: string; createdAt: Date; status: "INCOMPLETE" } | null>;
  };
};

export function getYapePaymentConfig() {
  return {
    accountName: process.env.NEXT_PUBLIC_YAPE_ACCOUNT_NAME ?? "MC Presupuestos",
    amount: process.env.NEXT_PUBLIC_YAPE_PRO_AMOUNT ?? PRO_FOUNDER_YAPE_AMOUNT,
    offerCode: PRO_FOUNDER_OFFER_CODE,
    phone: process.env.NEXT_PUBLIC_YAPE_PHONE ?? "",
    qrImageUrl: process.env.NEXT_PUBLIC_YAPE_QR_IMAGE_URL ?? "",
  };
}

export async function createWorkspaceYapePaymentRequest({
  prisma = defaultPrisma as unknown as YapePrismaClient,
  companyId,
}: {
  prisma?: YapePrismaClient;
  companyId: string;
}) {
  const existing = await prisma.companySubscription.findFirst({
    where: { companyId, provider: "MANUAL", status: "INCOMPLETE" },
    select: { id: true, createdAt: true, status: true },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return existing;
  }

  const proPlan = await prisma.membershipPlan.findUnique({ where: { slug: "pro" } });
  if (!proPlan) {
    throw new Error("Plan Pro no encontrado.");
  }

  return prisma.companySubscription.create({
    data: {
      companyId,
      membershipPlanId: proPlan.id,
      provider: "MANUAL",
      status: "INCOMPLETE",
    },
    select: { id: true, createdAt: true, status: true },
  });
}

export async function createYapePaymentRequest({
  prisma = defaultPrisma as unknown as YapePrismaClient,
  userId,
}: {
  prisma?: YapePrismaClient;
  userId: string;
}) {
  const existing = await prisma.billingSubscription.findFirst({
    where: { provider: "MANUAL", status: "INCOMPLETE", userId },
    select: { id: true, createdAt: true, status: true },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return existing;
  }

  return prisma.billingSubscription.create({
    data: {
      provider: "MANUAL",
      status: "INCOMPLETE",
      userId,
    },
    select: { id: true, createdAt: true, status: true },
  });
}
