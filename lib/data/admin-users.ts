import { prisma } from "@/lib/db/prisma";
import { issuePasswordReset } from "@/lib/auth/password-reset";
import { recordAdminAudit, type AdminAuditInput } from "@/lib/data/admin-audit";

export type AdminUserRole = "ADMIN" | "USER";
export type AdminUserStatus = "ACTIVE" | "SUSPENDED";

export type AdminActionContext = Pick<AdminAuditInput, "ipAddress" | "userAgent">;

export type UpdateUserAdminAccessInput = {
  aiTokenExtraMonthly: number;
  membershipPlanSlug: string;
  role: AdminUserRole;
  status: AdminUserStatus;
};

export async function updateUserAdminAccess(
  userId: string,
  input: UpdateUserAdminAccessInput,
  actorUserId?: string,
  context?: AdminActionContext,
) {
  const membershipPlan = await prisma.membershipPlan.findUnique({
    where: { slug: input.membershipPlanSlug },
  });

  if (!membershipPlan) {
    throw new Error("Plan de membresia no encontrado");
  }

  const targetUsers = actorUserId
    ? await prisma.$queryRaw<Array<{ email: string; isSuperAdmin: boolean }>>`
        SELECT "email", "isSuperAdmin"
        FROM "User"
        WHERE "id" = ${userId}
        LIMIT 1
      `
    : [];

  if (actorUserId && targetUsers[0]?.isSuperAdmin) {
    throw new Error("El administrador principal no puede ser modificado desde este panel.");
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

  if (actorUserId && targetUsers[0]) {
    await recordAdminAudit({
      actorUserId,
      targetUserId: userId,
      targetEmail: targetUsers[0].email,
      action: "USER_ACCESS_UPDATED",
      detail: "Rol, estado, membresia o tokens extra actualizados.",
      metadata: {
        role: input.role,
        status: input.status,
        membershipPlanSlug: input.membershipPlanSlug,
        aiTokenExtraMonthly: Math.max(0, Math.trunc(input.aiTokenExtraMonthly)),
      },
      ...context,
    });
  }
}

export async function verifyUserEmailManually(userId: string, actorUserId?: string, context?: AdminActionContext) {
  if (!actorUserId) {
    const updatedUsers = await prisma.$executeRaw`
      UPDATE "User"
      SET "emailVerifiedAt" = NOW()
      WHERE "id" = ${userId}
    `;

    if (updatedUsers === 0) {
      throw new Error("Usuario no encontrado");
    }

    return;
  }

  const users = await prisma.$queryRaw<Array<{ email: string }>>`
    SELECT "email"
    FROM "User"
    WHERE "id" = ${userId}
    LIMIT 1
  `;
  const user = users[0];

  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  await prisma.$executeRaw`
    UPDATE "User"
    SET "emailVerifiedAt" = NOW()
    WHERE "id" = ${userId}
  `;

  await recordAdminAudit({
    actorUserId,
    targetUserId: userId,
    targetEmail: user.email,
    action: "USER_EMAIL_VERIFIED",
    detail: "Correo verificado manualmente por un administrador.",
    ...context,
  });
}

export async function requestAdminPasswordReset(userId: string, actorUserId: string, context?: AdminActionContext) {
  const result = await issuePasswordReset(userId);

  await recordAdminAudit({
    actorUserId,
    targetUserId: userId,
    targetEmail: result.user.email,
    action: "PASSWORD_RESET_REQUESTED",
    detail: "Se envio un enlace para cambiar la contrasena.",
    ...context,
  });

  return { expiresAt: result.expiresAt };
}

export async function updateAdminUserStatus(
  userId: string,
  status: AdminUserStatus,
  actorUserId: string,
  context?: AdminActionContext,
) {
  if (userId === actorUserId) {
    throw new Error("No puedes cambiar el estado de tu propia cuenta.");
  }

  const users = await prisma.$queryRaw<Array<{ email: string; role: AdminUserRole; status: AdminUserStatus; isSuperAdmin: boolean }>>`
    SELECT "email", "role", "status", "isSuperAdmin"
    FROM "User"
    WHERE "id" = ${userId}
    LIMIT 1
  `;
  const user = users[0];

  if (!user) {
    throw new Error("Usuario no encontrado.");
  }

  if (user.isSuperAdmin) {
    throw new Error("El administrador principal no puede ser suspendido.");
  }

  if (status === "SUSPENDED" && user.role === "ADMIN") {
    const activeAdmins = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS "count"
      FROM "User"
      WHERE "role" = 'ADMIN' AND "status" = 'ACTIVE'
    `;

    if (Number(activeAdmins[0]?.count ?? 0) <= 1) {
      throw new Error("No puedes suspender al ultimo administrador activo.");
    }
  }

  await prisma.$executeRaw`
    UPDATE "User"
    SET "status" = ${status}, "updatedAt" = NOW()
    WHERE "id" = ${userId}
  `;

  await recordAdminAudit({
    actorUserId,
    targetUserId: userId,
    targetEmail: user.email,
    action: status === "SUSPENDED" ? "USER_SUSPENDED" : "USER_REACTIVATED",
    detail: status === "SUSPENDED" ? "Usuario suspendido." : "Usuario reactivado.",
    ...context,
  });
}

export async function deleteAdminUserPermanently(
  userId: string,
  actorUserId: string,
  confirmationEmail: string,
  context?: AdminActionContext,
) {
  if (userId === actorUserId) {
    throw new Error("No puedes eliminar tu propia cuenta.");
  }

  const actors = await prisma.$queryRaw<Array<{ isSuperAdmin: boolean }>>`
    SELECT "isSuperAdmin"
    FROM "User"
    WHERE "id" = ${actorUserId}
    LIMIT 1
  `;

  if (!actors[0]?.isSuperAdmin) {
    throw new Error("Solo el administrador principal puede eliminar usuarios permanentemente.");
  }

  const users = await prisma.$queryRaw<Array<{ email: string; isSuperAdmin: boolean }>>`
    SELECT "email", "isSuperAdmin"
    FROM "User"
    WHERE "id" = ${userId}
    LIMIT 1
  `;
  const user = users[0];

  if (!user) {
    throw new Error("Usuario no encontrado.");
  }

  if (user.isSuperAdmin) {
    throw new Error("El administrador principal no puede ser eliminado.");
  }

  if (confirmationEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    throw new Error("La confirmacion no coincide con el correo del usuario.");
  }

  await prisma.$executeRaw`
    DELETE FROM "User"
    WHERE "id" = ${userId}
  `;

  await recordAdminAudit({
    actorUserId,
    targetUserId: userId,
    targetEmail: user.email,
    action: "USER_DELETED_PERMANENTLY",
    detail: "Usuario eliminado permanentemente.",
    ...context,
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
