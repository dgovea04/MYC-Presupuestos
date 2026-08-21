import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { CompanyMembershipRole, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordWorkspaceAudit } from "@/lib/workspace/audit";
import { requireWorkspaceRole } from "@/lib/workspace/authorization";
import { assertWorkspaceHasSeat, WorkspaceSeatLimitError } from "@/lib/workspace/seats";

const TOKEN_BYTES = 32;

export function hashWorkspaceInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createWorkspaceInviteToken() {
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  return { token, tokenHash: hashWorkspaceInviteToken(token) };
}

export async function createWorkspaceInviteLink(options: {
  companyId: string;
  actorUserId: string;
  role: Exclude<CompanyMembershipRole, "OWNER">;
  expiresInDays: number;
  maxUses: number | null;
}) {
  await requireWorkspaceRole({ userId: options.actorUserId, companyId: options.companyId, minimumRole: "ADMIN" });
  const { token, tokenHash } = createWorkspaceInviteToken();
  const expiresAt = new Date(Date.now() + options.expiresInDays * 86_400_000);
  const link = await prisma.$transaction(async (tx) => {
    const created = await tx.workspaceInviteLink.create({ data: { id: randomUUID(), companyId: options.companyId, createdById: options.actorUserId, tokenHash, role: options.role, expiresAt, maxUses: options.maxUses } });
    await recordWorkspaceAudit({ companyId: options.companyId, actorUserId: options.actorUserId, action: "INVITE_LINK_CREATED", targetType: "WORKSPACE", targetId: created.id, metadata: { role: options.role, expiresAt: expiresAt.toISOString(), maxUses: options.maxUses } }, tx);
    return created;
  });
  return { link, token };
}

export async function listWorkspaceInviteLinks(companyId: string) {
  return prisma.workspaceInviteLink.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, select: { id: true, role: true, expiresAt: true, maxUses: true, useCount: true, revokedAt: true, createdAt: true } });
}

export async function revokeWorkspaceInviteLink(options: { companyId: string; actorUserId: string; linkId: string }) {
  await requireWorkspaceRole({ userId: options.actorUserId, companyId: options.companyId, minimumRole: "ADMIN" });
  return prisma.$transaction(async (tx) => {
    const link = await tx.workspaceInviteLink.updateMany({ where: { id: options.linkId, companyId: options.companyId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (link.count === 0) throw new Error("Enlace no encontrado o ya revocado");
    await recordWorkspaceAudit({ companyId: options.companyId, actorUserId: options.actorUserId, action: "INVITE_LINK_REVOKED", targetType: "WORKSPACE", targetId: options.linkId }, tx);
    return { ok: true };
  });
}

export async function acceptWorkspaceInviteLink(options: { token: string; userId: string }, client: Pick<PrismaClient, "workspaceInviteLink" | "workspaceInviteLinkUse" | "companyMembership" | "$transaction"> = prisma) {
  const tokenHash = hashWorkspaceInviteToken(options.token);
  return client.$transaction(async (tx) => {
    const link = await tx.workspaceInviteLink.findUnique({ where: { tokenHash }, include: { company: { select: { id: true, name: true, logoUrl: true } } } });
    if (!link || link.revokedAt || link.expiresAt <= new Date() || (link.maxUses !== null && link.useCount >= link.maxUses)) throw new Error("El enlace de invitación no es válido o ya expiró");
    const user = await tx.user.findUnique({ where: { id: options.userId }, select: { id: true, email: true } });
    if (!user) throw new Error("Usuario no encontrado");
    const membership = await tx.companyMembership.findUnique({ where: { companyId_userId: { companyId: link.companyId, userId: options.userId } }, select: { id: true, status: true, role: true } });
    if (membership?.status === "ACTIVE") return { workspace: link.company, role: membership.role, alreadyMember: true };
    try {
      await assertWorkspaceHasSeat(link.companyId, 1, tx);
    } catch (error) {
      if (error instanceof WorkspaceSeatLimitError) throw error;
      throw error;
    }
    const acceptedMembership = membership
      ? await tx.companyMembership.update({ where: { id: membership.id }, data: { role: link.role, status: "ACTIVE", joinedAt: new Date(), suspendedUntil: null } })
      : await tx.companyMembership.create({ data: { companyId: link.companyId, userId: options.userId, role: link.role, status: "ACTIVE" } });
    const account = await tx.workspaceInviteLinkUse.create({ data: { id: randomUUID(), inviteLinkId: link.id, userId: options.userId, email: user.email, membershipId: acceptedMembership.id } });
    await tx.workspaceInviteLink.update({ where: { id: link.id }, data: { useCount: { increment: 1 } } });
    await recordWorkspaceAudit({ companyId: link.companyId, actorUserId: options.userId, action: "MEMBER_INVITED", targetType: "MEMBER", targetId: options.userId, targetLabel: options.userId, metadata: { inviteLinkId: link.id, useId: account.id } }, tx);
    return { workspace: link.company, role: acceptedMembership.role, alreadyMember: false };
  });
}
