import { prisma as defaultPrisma } from "@/lib/db/prisma";
import { requireWorkspaceRole } from "@/lib/workspace/authorization";
import type { PrismaClient } from "@prisma/client";

export const AGENT_TOOL_NAMES = ["budget.read", "budget.write", "apu.read", "apu.write", "project.read", "project.write"] as const;
export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];
type Client = PrismaClient;

export class AgentDelegationAccessError extends Error {
  readonly statusCode = 403;
}

export async function createAgentDelegation(input: {
  actorUserId: string;
  workspaceId: string;
  delegateeId: string;
  toolNames: AgentToolName[];
  expiresAt: Date;
  projectId?: string | null;
  teamId?: string | null;
  prisma?: Client;
}) {
  const prisma = input.prisma ?? defaultPrisma;
  await requireWorkspaceRole({ userId: input.actorUserId, companyId: input.workspaceId, minimumRole: "ADMIN" });
  if (input.expiresAt <= new Date()) throw new AgentDelegationAccessError("La delegación debe expirar en el futuro.");
  if (input.toolNames.length === 0 || input.toolNames.some((tool) => !AGENT_TOOL_NAMES.includes(tool))) throw new AgentDelegationAccessError("La delegación requiere herramientas válidas.");
  const [delegatee, project, team] = await Promise.all([
    prisma.companyMembership.findFirst({ where: { companyId: input.workspaceId, userId: input.delegateeId, status: "ACTIVE" } }),
    input.projectId ? prisma.project.findFirst({ where: { id: input.projectId, companyId: input.workspaceId } }) : null,
    input.teamId ? prisma.workspaceTeam.findFirst({ where: { id: input.teamId, companyId: input.workspaceId, memberships: { some: { userId: input.delegateeId, companyId: input.workspaceId } } } }) : null,
  ]);
  if (!delegatee) throw new AgentDelegationAccessError("El usuario delegado no pertenece al workspace.");
  if (input.projectId && !project) throw new AgentDelegationAccessError("El proyecto no pertenece al workspace.");
  if (input.teamId && !team) throw new AgentDelegationAccessError("El equipo no pertenece al workspace o el usuario no es miembro.");
  return prisma.agentDelegation.create({ data: { workspaceId: input.workspaceId, delegatorId: input.actorUserId, delegateeId: input.delegateeId, projectId: input.projectId ?? null, teamId: input.teamId ?? null, toolNames: input.toolNames, expiresAt: input.expiresAt } });
}

export async function revokeAgentDelegation(input: { actorUserId: string; workspaceId: string; delegationId: string; prisma?: Client }) {
  const prisma = input.prisma ?? defaultPrisma;
  await requireWorkspaceRole({ userId: input.actorUserId, companyId: input.workspaceId, minimumRole: "ADMIN" });
  const delegation = await prisma.agentDelegation.findFirst({ where: { id: input.delegationId, workspaceId: input.workspaceId } });
  if (!delegation) throw new AgentDelegationAccessError("Delegación no encontrada.");
  return prisma.agentDelegation.update({ where: { id: delegation.id }, data: { status: "REVOKED", revokedAt: new Date(), revokedById: input.actorUserId } });
}

export async function canUseDelegatedAgent(input: { userId: string; workspaceId: string; toolName: string; projectId?: string | null; teamId?: string | null; prisma?: Client }) {
  const prisma = input.prisma ?? defaultPrisma;
  const now = new Date();
  const delegation = await prisma.agentDelegation.findFirst({ where: { workspaceId: input.workspaceId, delegateeId: input.userId, status: "ACTIVE", expiresAt: { gt: now }, toolNames: { has: input.toolName }, OR: [{ projectId: null, teamId: null }, { projectId: input.projectId ?? null, teamId: input.teamId ?? null }] } });
  return Boolean(delegation);
}

export async function expireAgentDelegations(prisma: Client = defaultPrisma) {
  return prisma.agentDelegation.updateMany({ where: { status: "ACTIVE", expiresAt: { lte: new Date() } }, data: { status: "EXPIRED" } });
}
