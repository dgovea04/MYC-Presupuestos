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

  await prisma.user.update({
    where: { id: userId },
    data: {
      role: input.role,
      status: input.status,
      membershipPlanId: membershipPlan.id,
      aiTokenExtraMonthly: Math.max(0, Math.trunc(input.aiTokenExtraMonthly)),
    },
  });
}
