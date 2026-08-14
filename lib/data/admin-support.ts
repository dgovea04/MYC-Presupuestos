import { prisma } from "@/lib/db/prisma";
import { recordAdminAudit, type AdminAuditInput } from "@/lib/data/admin-audit";

export type AdminSupportActionContext = Pick<AdminAuditInput, "ipAddress" | "userAgent">;

export async function getAdminSupportTarget(targetUserId: string) {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      isSuperAdmin: true,
      emailVerifiedAt: true,
      createdAt: true,
      membershipPlan: { select: { name: true, slug: true, billingMode: true } },
      companies: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { id: true, name: true },
      },
    },
  });

  if (!user || user.status !== "ACTIVE" || user.role !== "USER" || user.isSuperAdmin) {
    return null;
  }

  const companyId = user.companies[0]?.id ?? null;
  const [projectCount, budgetCount] = companyId
    ? await Promise.all([
        prisma.project.count({ where: { companyId } }),
        prisma.budget.count({ where: { project: { companyId } } }),
      ])
    : [0, 0];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt.toISOString(),
    planName: user.membershipPlan?.name ?? "Sin plan",
    planSlug: user.membershipPlan?.slug ?? null,
    billingMode: user.membershipPlan?.billingMode ?? null,
    companyName: user.companies[0]?.name ?? "Sin empresa",
    projectCount,
    budgetCount,
  };
}

export async function recordAdminSupportAudit(input: {
  actorUserId: string;
  targetUserId: string;
  targetEmail: string;
  action: "USER_SUPPORT_SESSION_STARTED" | "USER_SUPPORT_SESSION_STOPPED";
  context?: AdminSupportActionContext;
}) {
  await recordAdminAudit({
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    targetEmail: input.targetEmail,
    action: input.action,
    detail: input.action === "USER_SUPPORT_SESSION_STARTED"
      ? "Sesión de soporte limitada iniciada; datos de obra en solo lectura."
      : "Sesión de soporte limitada finalizada.",
    ...input.context,
  });
}
