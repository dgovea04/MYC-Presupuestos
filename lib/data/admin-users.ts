import { prisma } from "@/lib/db/prisma";

export type AdminUserRole = "ADMIN" | "USER";
export type AdminUserStatus = "ACTIVE" | "SUSPENDED";

export type UpdateUserAdminAccessInput = {
  aiTokenExtraMonthly: number;
  membershipPlanSlug: string;
  role: AdminUserRole;
  status: AdminUserStatus;
};

export async function updateUserAdminAccess(userId: string, input: UpdateUserAdminAccessInput) {
  const membershipPlan = await prisma.membershipPlan.findUnique({
    where: { slug: input.membershipPlanSlug },
  });

  if (!membershipPlan) {
    throw new Error("Plan de membresia no encontrado");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        role: input.role,
        status: input.status,
        membershipPlanId: membershipPlan.id,
        aiTokenExtraMonthly: Math.max(0, Math.trunc(input.aiTokenExtraMonthly)),
      },
    });

    if (membershipPlan.slug === "starter") {
      await tx.billingSubscription.updateMany({
        where: { userId, provider: "MANUAL", status: { in: ["ACTIVE", "TRIALING", "INCOMPLETE"] } },
        data: { status: "CANCELED", cancelAtPeriodEnd: true },
      });
      return;
    }

    if (membershipPlan.slug === "pro" || membershipPlan.slug === "empresa") {
      await tx.billingSubscription.updateMany({
        where: { userId, provider: "MANUAL", status: "INCOMPLETE" },
        data: { status: "CANCELED", cancelAtPeriodEnd: true },
      });
      await tx.billingSubscription.create({
        data: {
          provider: "MANUAL",
          status: "ACTIVE",
          userId,
          currentPeriodStart: new Date(),
        },
      });
    }
  });
}

export async function verifyUserEmailManually(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerifiedAt: new Date(),
    },
  });
}

export async function activateManualProRequest(requestId: string) {
  const proPlan = await prisma.membershipPlan.findUnique({
    where: { slug: "pro" },
    select: { id: true },
  });

  if (!proPlan) {
    throw new Error("Plan Pro no encontrado");
  }

  await prisma.$transaction(async (tx) => {
    const request = await tx.billingSubscription.findFirst({
      where: {
        id: requestId,
        provider: "MANUAL",
        status: "INCOMPLETE",
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!request) {
      throw new Error("Solicitud manual pendiente no encontrada");
    }

    await tx.billingSubscription.update({
      where: { id: request.id },
      data: {
        status: "CANCELED",
        cancelAtPeriodEnd: true,
      },
    });

    await tx.billingSubscription.create({
      data: {
        provider: "MANUAL",
        status: "ACTIVE",
        userId: request.userId,
        currentPeriodStart: new Date(),
      },
    });

    await tx.user.update({
      where: { id: request.userId },
      data: {
        membershipPlanId: proPlan.id,
        status: "ACTIVE",
      },
    });
  });
}
