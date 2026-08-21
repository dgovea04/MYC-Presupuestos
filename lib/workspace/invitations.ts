import type { CompanyMembershipRole, CompanyMembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordWorkspaceAudit } from "@/lib/workspace/audit";
import { requireWorkspaceRole } from "@/lib/workspace/authorization";
import { assertWorkspaceHasSeat } from "@/lib/workspace/seats";

const EMAIL_TOKEN_SPLIT = /[,;\n]+/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normaliza un bloque de texto con emails separados por coma, punto y coma o
 * nueva línea. Devuelve la lista deduplicada de emails válidos y los tokens
 * que no superaron la validación, preservando el orden de aparición.
 */
export function parseBulkInviteEmails(raw: string): { emails: string[]; invalid: string[] } {
  const emails: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const token of raw.split(EMAIL_TOKEN_SPLIT)) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const normalized = trimmed.toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      invalid.push(trimmed);
      continue;
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    emails.push(normalized);
  }

  return { emails, invalid };
}

export type InvitedMember = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatarUrl: string | null;
  role: CompanyMembershipRole;
  status: CompanyMembershipStatus;
  invitedByName: string | null;
  joinedAt: string;
};

export type InviteMemberResult =
  | { ok: true; member: InvitedMember }
  | { ok: false; code: "NOT_FOUND"; email: string }
  | { ok: false; code: "SELF"; email: string }
  | { ok: false; code: "ALREADY_MEMBER"; email: string; existingStatus: CompanyMembershipStatus };

/**
 * Invita a un único usuario a un workspace como EDITOR con estado INVITED.
 * El llamador ya debe haber verificado autorización (ADMIN+) y feature access.
 */
export async function inviteWorkspaceMember(options: {
  companyId: string;
  actorUserId: string;
  email: string;
}): Promise<InviteMemberResult> {
  const email = options.email.trim().toLowerCase();

  const invitee = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });
  if (!invitee) return { ok: false, code: "NOT_FOUND", email };
  if (invitee.id === options.actorUserId) return { ok: false, code: "SELF", email };

  const existingMembership = await prisma.companyMembership.findUnique({
    where: { companyId_userId: { companyId: options.companyId, userId: invitee.id } },
    select: { status: true },
  });
  if (existingMembership) {
    return { ok: false, code: "ALREADY_MEMBER", email, existingStatus: existingMembership.status };
  }

  await assertWorkspaceHasSeat(options.companyId);

  const membership = await prisma.companyMembership.create({
    data: {
      companyId: options.companyId,
      userId: invitee.id,
      role: "EDITOR",
      status: "INVITED",
      invitedById: options.actorUserId,
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      invitedBy: { select: { id: true, name: true } },
    },
  });

  await recordWorkspaceAudit({
    companyId: options.companyId,
    actorUserId: options.actorUserId,
    action: "MEMBER_INVITED",
    targetType: "MEMBER",
    targetId: membership.userId,
    targetLabel: membership.user.name ?? membership.user.email,
    metadata: { role: membership.role },
  });

  return {
    ok: true,
    member: {
      id: membership.id,
      userId: membership.userId,
      userName: membership.user.name,
      userEmail: membership.user.email,
      userAvatarUrl: membership.user.avatarUrl,
      role: membership.role,
      status: membership.status,
      invitedByName: membership.invitedBy?.name ?? null,
      joinedAt: membership.joinedAt.toISOString(),
    },
  };
}

export type BulkInviteEmailResult =
  | { email: string; status: "created"; userId: string }
  | { email: string; status: "not_found" }
  | { email: string; status: "self" }
  | { email: string; status: "already_member"; existingStatus: CompanyMembershipStatus };

export type BulkInviteResult = {
  results: BulkInviteEmailResult[];
  invalid: string[];
  createdCount: number;
  rejectedCount: number;
};

/**
 * Invitación masiva coordinada. Prevalida el lote (usuarios existentes, self,
 * duplicados y capacidad de asientos) y, si el workspace no tiene capacidad
 * suficiente para los nuevos miembros, rechaza todo el lote antes de mutar.
 */
export async function bulkInviteWorkspaceMembers(options: {
  companyId: string;
  actorUserId: string;
  emailsText: string;
}): Promise<BulkInviteResult> {
  await requireWorkspaceRole({ userId: options.actorUserId, companyId: options.companyId, minimumRole: "ADMIN" });

  const { emails, invalid } = parseBulkInviteEmails(options.emailsText);

  const invitees = emails.length
    ? await prisma.user.findMany({
        where: { email: { in: emails } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const inviteeByEmail = new Map(invitees.map((user) => [user.email, user]));

  const results = await prisma.$transaction(async (tx) => {
    const outcomeByEmail = new Map<string, BulkInviteEmailResult>();
    const candidates: Array<{ email: string; userId: string; name: string }> = [];

    for (const email of emails) {
      const invitee = inviteeByEmail.get(email);
      if (!invitee) {
        outcomeByEmail.set(email, { email, status: "not_found" });
        continue;
      }
      if (invitee.id === options.actorUserId) {
        outcomeByEmail.set(email, { email, status: "self" });
        continue;
      }
      candidates.push({ email, userId: invitee.id, name: invitee.name ?? invitee.email });
    }

    const existing = candidates.length
      ? await tx.companyMembership.findMany({
          where: { companyId: options.companyId, userId: { in: candidates.map((candidate) => candidate.userId) } },
          select: { userId: true, status: true },
        })
      : [];
    const existingStatusByUserId = new Map(existing.map((membership) => [membership.userId, membership.status]));

    const creatable = candidates.filter((candidate) => {
      const status = existingStatusByUserId.get(candidate.userId);
      if (status) {
        outcomeByEmail.set(candidate.email, { email: candidate.email, status: "already_member", existingStatus: status });
        return false;
      }
      return true;
    });

    if (creatable.length > 0) {
      // El chequeo comparte la transacción con la creación para evitar TOCTOU.
      await assertWorkspaceHasSeat(options.companyId, creatable.length, tx);
      for (const candidate of creatable) {
        await tx.companyMembership.create({
          data: {
            companyId: options.companyId,
            userId: candidate.userId,
            role: "EDITOR",
            status: "INVITED",
            invitedById: options.actorUserId,
          },
        });
        await recordWorkspaceAudit(
          {
            companyId: options.companyId,
            actorUserId: options.actorUserId,
            action: "MEMBER_INVITED",
            targetType: "MEMBER",
            targetId: candidate.userId,
            targetLabel: candidate.name,
            metadata: { role: "EDITOR", bulk: true },
          },
          tx,
        );
        outcomeByEmail.set(candidate.email, { email: candidate.email, status: "created", userId: candidate.userId });
      }
    }

    return emails.map((email) => outcomeByEmail.get(email) ?? { email, status: "not_found" as const });
  });

  const createdCount = results.filter((result) => result.status === "created").length;

  return { results, invalid, createdCount, rejectedCount: results.length - createdCount };
}
