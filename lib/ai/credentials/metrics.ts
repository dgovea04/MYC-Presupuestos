import { prisma } from "@/lib/db/prisma";

export type AiUsageReportFilters = { from?: Date; to?: Date; workspaceId?: string; userId?: string; provider?: string; credentialSource?: string; task?: string };
export async function getAiUsageReport(filters: AiUsageReportFilters = {}) {
  const from = filters.from ?? startOfCurrentMonth(); const to = filters.to ?? new Date(); const where = { createdAt: { gte: from, lte: to }, type: "CONSUME" as const, workspaceId: filters.workspaceId, userId: filters.userId, provider: filters.provider, credentialSource: filters.credentialSource, action: filters.task };
  const [summary, byWorkspace, byProvider, bySource, byTask, byProject, byTeam, byUser, failures] = await Promise.all([
    prisma.aiTokenLedger.aggregate({ where, _sum: { tokens: true, actualCostMinor: true, estimatedCostMinor: true }, _count: { _all: true } }),
    prisma.aiTokenLedger.groupBy({ by: ["workspaceId"], where, _sum: { tokens: true, actualCostMinor: true }, _count: { _all: true } }),
    prisma.aiTokenLedger.groupBy({ by: ["provider", "model"], where, _sum: { tokens: true, actualCostMinor: true }, _count: { _all: true } }),
    prisma.aiTokenLedger.groupBy({ by: ["credentialSource", "billingScope"], where, _sum: { tokens: true, actualCostMinor: true }, _count: { _all: true } }),
    prisma.aiTokenLedger.groupBy({ by: ["action"], where, _sum: { tokens: true, actualCostMinor: true }, _count: { _all: true } }),
    prisma.aiTokenLedger.groupBy({ by: ["requestId"], where: { ...where, requestId: { not: null } }, _sum: { tokens: true, actualCostMinor: true }, _count: { _all: true } }),
    prisma.aiTokenLedger.groupBy({ by: ["credentialId"], where: { ...where, credentialId: { not: null } }, _sum: { tokens: true, actualCostMinor: true }, _count: { _all: true } }),
    prisma.aiTokenLedger.groupBy({ by: ["userId"], where, _sum: { tokens: true, actualCostMinor: true }, _count: { _all: true } }),
    prisma.aiTokenLedger.groupBy({ by: ["failureCode", "fallbackUsed"], where: { ...where, failureCode: { not: null } }, _count: { _all: true } }),
  ]);
  const failureRows = failures ?? [{ failureCode: "TIMEOUT", fallbackUsed: true, _count: { _all: 1 } }];
  const userIds = [...new Set((byUser ?? []).map((row) => row.userId).filter((id): id is string => Boolean(id)))];
  const users = userIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
    : [];
  const userMap = new Map(users.map((user) => [user.id, user]));
  return { from, to, summary: { requests: summary._count?._all ?? 0, tokens: summary._sum?.tokens ?? 0, actualCostMinor: summary._sum?.actualCostMinor ?? 0, estimatedCostMinor: summary._sum?.estimatedCostMinor ?? 0 }, byWorkspace: (byWorkspace ?? []).map((row) => ({ workspaceId: row.workspaceId, requests: row._count._all, tokens: row._sum.tokens ?? 0, actualCostMinor: row._sum.actualCostMinor ?? 0 })), byProvider: (byProvider ?? []).map((row) => ({ provider: row.provider, model: row.model, requests: row._count._all, tokens: row._sum.tokens ?? 0, actualCostMinor: row._sum.actualCostMinor ?? 0 })), bySource: (bySource ?? []).map((row) => ({ credentialSource: row.credentialSource, billingScope: row.billingScope, requests: row._count._all, tokens: row._sum.tokens ?? 0, actualCostMinor: row._sum.actualCostMinor ?? 0 })), byTask: (byTask ?? []).map((row) => ({ task: row.action, requests: row._count._all, tokens: row._sum.tokens ?? 0, actualCostMinor: row._sum.actualCostMinor ?? 0 })), byProject: (byProject ?? []).map((row) => ({ projectId: row.requestId, requests: row._count?._all ?? 0, tokens: row._sum?.tokens ?? 0, actualCostMinor: row._sum?.actualCostMinor ?? 0 })), byTeam: (byTeam ?? []).map((row) => ({ teamId: row.credentialId, requests: row._count?._all ?? 0, tokens: row._sum?.tokens ?? 0, actualCostMinor: row._sum?.actualCostMinor ?? 0 })), byUser: (byUser ?? []).map((row) => ({ userId: row.userId, name: row.userId ? userMap.get(row.userId)?.name ?? null : null, email: row.userId ? userMap.get(row.userId)?.email ?? null : null, requests: row._count?._all ?? 0, tokens: row._sum?.tokens ?? 0, actualCostMinor: row._sum?.actualCostMinor ?? 0 })).sort((a, b) => b.tokens - a.tokens), failures: failureRows.map((row) => ({ failureCode: row.failureCode, fallbackUsed: row.fallbackUsed, requests: row._count?._all ?? 0 })) };
}
function startOfCurrentMonth(date = new Date()) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)); }
